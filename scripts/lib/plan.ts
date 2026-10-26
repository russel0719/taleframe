import fs from 'node:fs';
import path from 'node:path';
import { fail, loadEnv, readJson, workDir, writeJson } from './common';
import { groupMatches, matchPhoto, type AskGroup, type Confidence, type ConfirmGroup, type PlanExport, type PlanMatch, type PlanTrip } from './planMatch';
import { loadInventory } from './scan';

/**
 * travel-plan(여행 플래너 앱)의 계획을 읽어 사진마다 "어디서 무엇을 하던 중이었나"를 맞춘다.
 *
 * - travel-plan 의 읽기 전용 내보내기 API(`/api/export/*`)를 개인 토큰으로 부른다. DB 키는 갖지 않는다
 * - **스토리를 만들 때 이 PC 에서만** 부른다. 빌드·배포·브라우저에서는 절대 부르지 않는다
 * - 결과는 work/<slug>/plan.json · plan-matches.json (gitignore). 계획 자체(메모·가격)는 확인을 거쳐 스토리에 쓴다
 * - 계획은 사용자가 직접 적은 자료지만 실제와 다를 수 있다 → 스킬·Studio 가 일괄 확인 한 번을 거쳐 사실로 쓴다 (interview.md)
 *
 * 설정 (.env.local, gitignore): TRAVEL_PLAN_URL=https://<travel-plan 배포 주소> · TRAVEL_PLAN_TOKEN=<travel-plan 의 EXPORT_API_TOKEN>
 */

export const planPath = (slug: string) => path.join(workDir(slug), 'plan.json');
export const matchesPath = (slug: string) => path.join(workDir(slug), 'plan-matches.json');
/** 질문 단계가 읽는 작은 요약 — 사진별 매칭 전체를 읽히면 headless 한 번에 $1 이 넘었다 (실측) */
export const questionsPath = (slug: string) => path.join(workDir(slug), 'plan-questions.json');

export type SavedPlan = PlanExport & { fetchedAt: string; source: string };
export type SavedMatches = {
  trip: { id: string; title: string };
  summary: Record<Confidence | 'none', number>;
  /** 일괄 확인할 "계획대로 다닌 곳" (일정 하나 = 한 줄) */
  confirm: ConfirmGroup[];
  /** 따로 물을 어긋남 묶음 (묶음 하나 = 질문 하나) */
  ask: AskGroup[];
  photos: Record<string, PlanMatch>;
};

export function planConfigured() {
  loadEnv();
  return Boolean(process.env.TRAVEL_PLAN_URL && process.env.TRAVEL_PLAN_TOKEN);
}

export function loadPlan(slug: string): SavedPlan | null {
  return fs.existsSync(planPath(slug)) ? readJson<SavedPlan>(planPath(slug)) : null;
}

async function api<T>(route: string): Promise<T> {
  loadEnv();
  const base = process.env.TRAVEL_PLAN_URL?.replace(/\/$/, '');
  const token = process.env.TRAVEL_PLAN_TOKEN;
  if (!base || !token) fail('travel-plan 연결 설정이 없다 — .env.local 에 TRAVEL_PLAN_URL · TRAVEL_PLAN_TOKEN 을 넣는다 (docs: ~/.claude/docs/projects/taleframe.md)');
  let res: Response;
  try {
    res = await fetch(`${base}/api/export${route}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    fail(`travel-plan 에 연결하지 못했다 (${base}): ${(e as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401) fail('travel-plan 이 토큰을 거부했다 — TRAVEL_PLAN_TOKEN 이 travel-plan 의 EXPORT_API_TOKEN 과 같은지 확인');
  if (res.status === 503) fail(`travel-plan 쪽 설정이 비어 있다: ${body.error ?? ''} (Vercel 환경변수)`);
  if (res.status === 404 && !body.error) fail(`${base} 에 내보내기 API 가 없다 — 주소가 맞는지, travel-plan 이 배포됐는지 확인`);
  if (!res.ok) fail(`travel-plan ${res.status}: ${body.error ?? res.statusText}`);
  return body as T;
}

function dateRange(slug: string) {
  const days = loadInventory(slug)
    .items.map((it) => it.takenAt?.slice(0, 10))
    .filter((d): d is string => !!d)
    .sort();
  if (!days.length) fail('촬영 날짜가 있는 사진이 없다 — 계획과 맞출 수 없다');
  return { from: days[0], to: days[days.length - 1] };
}

/** 묶음에서 고르게 4장 */
const pick4 = (ids: string[]) => (ids.length <= 4 ? ids : [0, 1, 2, 3].map((k) => ids[Math.round((k * (ids.length - 1)) / 3)]));

export function matchAll(slug: string, data: PlanExport): SavedMatches {
  const summary: SavedMatches['summary'] = { confident: 0, conflict: 0, place: 0, nearby: 0, day: 0, none: 0 };
  const photos: Record<string, PlanMatch> = {};
  const items = loadInventory(slug).items;
  for (const it of items) {
    const m = matchPhoto(it.takenAt, it.gps ? [it.gps.lat, it.gps.lng] : null, data.schedule);
    if (m) {
      photos[it.id] = m;
      summary[m.confidence]++;
    } else summary.none++;
  }
  const { confirm, ask } = groupMatches(items, photos, data.schedule);
  return { trip: { id: data.trip.id, title: data.trip.title }, summary, confirm, ask, photos };
}

export async function plan(slug: string, { trip, file }: { trip?: string; file?: string } = {}) {
  let data: PlanExport;
  let source: string;
  if (file) {
    // 배포 전 시험·오프라인용 — 내보내기 API 응답을 저장해 둔 JSON
    data = readJson<PlanExport>(file);
    source = `file:${path.basename(file)}`;
  } else {
    const { from, to } = dateRange(slug);
    let id = trip;
    if (!id) {
      const { trips } = await api<{ trips: PlanTrip[] }>(`/trips?from=${from}&to=${to}`);
      if (!trips.length) fail(`travel-plan 에 ${from} ~ ${to} 와 겹치는 여행이 없다`);
      if (trips.length > 1) {
        console.log('겹치는 여행이 여럿이다 — --trip <id> 로 고른다:');
        for (const t of trips) console.log(`  ${t.id}  ${t.title} (${t.start_date} ~ ${t.end_date})`);
        process.exit(2);
      }
      id = trips[0].id;
    }
    data = await api<PlanExport>(`/trips/${id}`);
    source = new URL(process.env.TRAVEL_PLAN_URL!).host;
  }
  if (data.version !== 1) fail(`모르는 내보내기 형식 version ${data.version} — planMatch.ts 의 타입을 확인`);

  writeJson(planPath(slug), { ...data, fetchedAt: new Date().toISOString(), source } satisfies SavedPlan);
  const m = matchAll(slug, data);
  writeJson(matchesPath(slug), m);
  writeJson(questionsPath(slug), {
    trip: m.trip,
    summary: m.summary,
    // 사진 id 는 질문에 붙일 만큼(4장)만 — 전체 목록은 plan-matches.json
    confirm: m.confirm.map(({ photos, ...g }) => ({ ...g, count: photos.length, media: pick4(photos) })),
    ask: m.ask.map(({ photos, ...g }) => ({ ...g, count: photos.length, media: pick4(photos) })),
    flights: data.flights,
    // 사진 id → 일정 제목 (확인용 묶음에 안 든 사진이 어디 속했는지 볼 때)
    note: '사진별 상세는 plan-matches.json, 일정 메모(notes·가격)는 plan.json — 질문 단계에서는 읽지 않아도 된다',
  });

  const s = m.summary;
  console.log(`✓ ${data.trip.title} (${data.trip.start_date} ~ ${data.trip.end_date}) — 일정 ${data.schedule.length} · 항공편 ${data.flights.length} · 숙소 ${data.lodging.length}`);
  console.log(`  사진 매칭: 확실 ${s.confident} · 좌표로 확인 ${s.place} · 어긋남 ${s.conflict} · 시각 근처 ${s.nearby} · 같은 날 ${s.day} · 계획 밖 ${s.none}`);
  console.log(`  질문: 일괄 확인 1번(일정 ${m.confirm.length}곳) + 어긋남 ${m.ask.length}묶음`);
  for (const a of m.ask) console.log(`    ? ${a.day.slice(5)} ${a.first}–${a.last} 사진 ${a.photos.length}장 — 계획 "${a.title}"(${a.planned ?? '시각 없음'}) ↔ 좌표 "${a.byPlace.title}"`);
  if (data.errors?.length) console.log(`  ⚠ travel-plan 이 일부를 못 읽었다: ${data.errors.join(' / ')}`);
  console.log(`→ ${path.relative(process.cwd(), matchesPath(slug))}`);
}
