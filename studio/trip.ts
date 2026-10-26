import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MediaManifest, Story } from '@/lib/story/schema';
import { runClaude } from './agent';
import { ANALYZE_MODEL, OUT, SITE_URL, STORIES, WORK, readJsonFile, slugDir, studioDir, writeJsonFile } from './config';
import { jobOf, startJob, type Ctx } from './jobs';
import {
  AnalysisBatch,
  PlanStep,
  QuestionStep,
  ReviseResult,
  WriteResult,
  analyzePrompt,
  fixPrompt,
  gapsPrompt,
  layoutPrompt,
  phasePrompt,
  revisePrompt,
  writePrompt,
  type AnalysisEntry,
  type Phase,
  type Question,
} from './prompts';
import { inboxStats } from './upload';

/**
 * 여행 하나의 상태 — 전부 파일에서 계산한다 (`tf status` 와 같은 원칙: 파일 존재 = 진행 상태).
 * 그래서 서버를 껐다 켜도, 폰을 닫았다 열어도 같은 자리에서 이어진다.
 *
 * 흐름 (interview.md 의 다섯 단계):
 *   사진 올리기 → 정리·훑어보기 → ① 사진 질문 → ② 웹 방향 → ③ 레이아웃 승인 → ④ 초안 만들기
 *   → 초안 확인·⑤ 보완 질문 (반복) → 게시
 */

type InvItem = { id: string; file: string; kind: 'image' | 'video'; gps: unknown; takenAt: string | null };
type Inventory = { items: InvItem[]; skipped: { file: string; reason: string }[] };
type Interview = { at: string; q: string; a: string; phase?: string; media?: string[]; plan?: unknown }[];

/** 질문 단계에서 기다리는 질문 묶음 (studio/next.json) */
export type Pending =
  | ({ phase: Phase } & QuestionStep)
  | ({ phase: 'layout'; kind: 'plan' } & PlanStep);

const P = (slug: string, f: string) => path.join(slugDir(slug), f);

/**
 * story.json 의 "내용" 지문 — 승인 상태(status)·updatedAt 은 뺀다.
 * 승인만 했을 때 파생 파일·미리보기를 다시 만들 필요가 없는데, 파일 수정 시각으로 비교하면
 * 승인할 때마다 "내용이 바뀌었다"고 오해해 초안 만들기로 되돌아갔다 (e2e 로 발견).
 */
function contentKey(file: string): string {
  if (!fs.existsSync(file)) return '';
  const strip = JSON.stringify(JSON.parse(fs.readFileSync(file, 'utf8')), (k, v) => (k === 'status' || k === 'updatedAt' ? undefined : v));
  return crypto.createHash('sha1').update(strip).digest('hex').slice(0, 12);
}
const S = (slug: string, f: string) => path.join(studioDir(slug), f);
const storyPath = (slug: string) => path.join(STORIES, slug, 'story.json');

export function tripMeta(slug: string) {
  return readJsonFile<{ name: string; createdAt: string } | null>(S(slug, 'meta.json'), null);
}

/** 게시 주소가 된다. 한글 이름에서 숫자만 남으면("다카마쓰 2026" → "2026") 쓰지 않는다 — 영문 주소를 따로 받는다 */
export function createTrip(name: string, address = ''): string {
  const kebab = (s: string) =>
    s
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  const fromName = kebab(name);
  const base = kebab(address) || (/[a-z]/.test(fromName) ? fromName : `trip-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`);
  let slug = base;
  for (let i = 2; fs.existsSync(slugDir(slug)) || fs.existsSync(path.join(STORIES, slug)); i++) slug = `${base}-${i}`;
  fs.mkdirSync(path.join(slugDir(slug), 'inbox'), { recursive: true });
  writeJsonFile(S(slug, 'meta.json'), { name: name.trim() || slug, createdAt: new Date().toISOString() });
  return slug;
}

export function listTrips() {
  if (!fs.existsSync(WORK)) return [];
  return fs
    .readdirSync(WORK, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (tripMeta(d.name) || fs.existsSync(P(d.name, 'inventory.json'))))
    .map((d) => tripState(d.name))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export type Section = { id: string; template: string; status: string; locked?: boolean; label: string; media: string[]; memo?: string };

function sectionLabel(s: Record<string, unknown>): string {
  for (const k of ['title', 'heading', 'caption', 'quote', 'line', 'text', 'name', 'day']) {
    if (typeof s[k] === 'string') return s[k] as string;
  }
  const steps = s.steps as { text?: string }[] | undefined;
  if (steps?.[0]?.text) return steps[0].text;
  const lines = s.lines as string[] | undefined;
  if (lines?.length) return lines.join(' / ');
  return '';
}

function sectionMedia(s: Record<string, unknown>): string[] {
  const ids = JSON.stringify(s).match(/"m\d{3,4}"/g) ?? [];
  return [...new Set(ids.map((x) => x.slice(1, -1)))].slice(0, 4);
}

export function tripState(slug: string) {
  const meta = tripMeta(slug);
  const inbox = inboxStats(slug);
  const inv = readJsonFile<Inventory | null>(P(slug, 'inventory.json'), null);
  const analysis = readJsonFile<AnalysisEntry[]>(P(slug, 'analysis.json'), []);
  const interview = readJsonFile<Interview>(P(slug, 'interview.json'), []);
  const pending = readJsonFile<Pending | null>(S(slug, 'next.json'), null);
  const phases = readJsonFile<{ photos?: boolean; direction?: boolean }>(S(slug, 'phases.json'), {});
  const gaps = readJsonFile<{ message: string; questions: Question[] } | null>(S(slug, 'gaps.json'), null);
  const scannedFiles = new Set(inv?.items.map((i) => i.file) ?? []);
  const needsScan = inbox.files.some((f) => !scannedFiles.has(f) && !inv?.skipped.some((s) => s.file === f));
  const analyzed = new Set(analysis.map((a) => a.id));
  const total = inv?.items.length ?? 0;
  const hasGps = inv?.items.some((i) => i.gps) ?? false;
  const places = fs.existsSync(P(slug, 'places.json'));
  // travel-plan 계획과의 매칭 (tf plan) — 질문을 줄이는 재료
  const planM = readJsonFile<{ trip: { title: string }; confirm: unknown[]; ask: unknown[]; summary: Record<string, number> } | null>(P(slug, 'plan-matches.json'), null);
  const travelPlan = planM && { title: planM.trip.title, confirm: planM.confirm.length, ask: planM.ask.length, outside: planM.summary.none ?? 0 };
  const planApproved = interview.some((x) => x.at === 'plan' && x.a === '승인');

  const sp = storyPath(slug);
  const parsed = fs.existsSync(sp) ? Story.safeParse(readJsonFile(sp, null)) : null;
  const story = parsed?.success ? parsed.data : null;
  const mPath = path.join(STORIES, slug, 'media.json');
  const manifest = fs.existsSync(mPath) ? MediaManifest.safeParse(readJsonFile(mPath, null)) : null;
  const mtime = (p: string) => (fs.existsSync(p) ? fs.statSync(p).mtimeMs : 0);
  const preview = readJsonFile<{ builtAt: number; key?: string } | null>(S(slug, 'preview.json'), null);
  const key = contentKey(sp);
  const usage = readJsonFile<{ usd: number; jobs: number }>(S(slug, 'usage.json'), { usd: 0, jobs: 0 });
  const sections: Section[] = (story?.sections ?? []).map((s) => ({
    id: s.id,
    template: s.template,
    status: s.status,
    locked: s.locked,
    memo: s.memo,
    label: sectionLabel(s as unknown as Record<string, unknown>),
    media: sectionMedia(s as unknown as Record<string, unknown>),
  }));
  const published = readJsonFile<{ at: string; url: string; commit: string } | null>(S(slug, 'published.json'), null);

  return {
    slug,
    name: meta?.name ?? story?.title ?? slug,
    createdAt: meta?.createdAt,
    inbox,
    scanned: !!inv,
    needsScan,
    skipped: inv?.skipped ?? [],
    analysis: { done: inv?.items.filter((i) => analyzed.has(i.id)).length ?? 0, total },
    hasGps,
    places,
    travelPlan,
    interview,
    pending,
    phases,
    planApproved,
    gaps: gaps?.questions.length ? gaps : null,
    story,
    storyInvalid: parsed && !parsed.success ? parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`) : null,
    sections,
    // 파생 파일은 미리보기 빌드와 함께 만들어지므로, 미리보기의 내용 지문이 같으면 파생 파일도 최신이다
    hasMedia: !!manifest?.success && (preview?.key === key || mtime(mPath) >= mtime(sp)),
    previewFresh: !!preview && preview.key === key,
    usage,
    allApproved: sections.length > 0 && sections.every((s) => s.status === 'approved'),
    published: story?.status === 'published' ? published : null,
    job: jobOf(slug),
  };
}
export type TripState = ReturnType<typeof tripState>;

/** 단계 레일 — 절차가 화면의 뼈대다 */
export const STEPS = [
  { id: 'upload', title: '사진 올리기' },
  { id: 'prepare', title: '정리·훑어보기' },
  { id: 'photos', title: '사진 질문' },
  { id: 'direction', title: '웹 방향' },
  { id: 'layout', title: '레이아웃' },
  { id: 'draft', title: '초안 만들기' },
  { id: 'review', title: '초안 확인·보완' },
  { id: 'publish', title: '게시' },
] as const;
export type StepId = (typeof STEPS)[number]['id'];

export function currentStep(s: TripState): StepId {
  if (!s.inbox.files.length && !s.scanned) return 'upload';
  if (!s.scanned || s.needsScan || s.analysis.done < s.analysis.total || (s.hasGps && !s.places)) return 'prepare';
  // 이미 초안이 있는 여행(스킬로 만든 것 포함)은 질문 단계를 건너뛴다
  if (!s.story) {
    if (!s.phases.photos) return 'photos';
    if (!s.phases.direction) return 'direction';
    if (!s.planApproved) return 'layout';
    return 'draft';
  }
  if (!s.hasMedia || !s.previewFresh) return 'draft';
  if (!s.allApproved || s.gaps) return 'review';
  return 'publish';
}

export function stepDone(s: TripState, id: StepId): boolean {
  const order = STEPS.map((x) => x.id);
  const cur = currentStep(s);
  if (cur === 'publish' && s.published) return true;
  return order.indexOf(id) < order.indexOf(cur);
}

// ── 작업들 ────────────────────────────────────────────────────

const tf = (ctx: Ctx, ...args: string[]) => ctx.sh('npm', ['run', '-s', 'tf', '--', ...args]);

async function analyze(ctx: Ctx, slug: string) {
  const inv = readJsonFile<Inventory>(P(slug, 'inventory.json'), { items: [], skipped: [] });
  const items = [...inv.items].sort((a, b) => a.id.localeCompare(b.id));
  const file = P(slug, 'analysis.json');
  const PER = 12; // scan 의 밀착 인화지와 같은 묶음
  const sheets = Math.ceil(items.length / PER);
  for (let s = 0; s < sheets; s++) {
    const have = new Set(readJsonFile<AnalysisEntry[]>(file, []).map((a) => a.id));
    const group = items.slice(s * PER, (s + 1) * PER);
    ctx.progress(s, sheets);
    if (group.every((it) => have.has(it.id))) continue;
    const sheet = `sheets/sheet-${String(s + 1).padStart(2, '0')}.jpg`;
    const ids = group.map((it) => it.id);
    ctx.log(`· 시트 ${s + 1}/${sheets} (${ids[0]}~${ids[ids.length - 1]})`);
    const r = await runClaude({
      prompt: analyzePrompt(slug, sheet, ids, group.filter((it) => it.kind === 'video').map((it) => it.id)),
      schema: AnalysisBatch,
      slug,
      model: ANALYZE_MODEL,
      log: ctx.log, activity: ctx.activity,
    });
    ctx.cost(r.costUsd);
    // 시트마다 바로 디스크에 — 끊겨도 본 데까지는 남는다
    const merged = new Map(readJsonFile<AnalysisEntry[]>(file, []).map((a) => [a.id, a]));
    for (const e of r.data.entries) if (ids.includes(e.id)) merged.set(e.id, e);
    writeJsonFile(file, [...merged.values()].sort((a, b) => a.id.localeCompare(b.id)));
  }
  ctx.progress(sheets, sheets);
}

/**
 * 다음 질문 묶음을 만든다. 단계는 서버가 파일로 정하고, Claude 에게는 그 단계의 일만 시킨다.
 * ①② 에서 Claude 가 "done" 이라 하면 다음 단계로 넘어가 같은 작업 안에서 이어서 묻는다.
 * 레이아웃이 승인돼 있으면 초안 만들기로 넘어간다.
 */
async function ask(ctx: Ctx, slug: string) {
  for (const phase of ['photos', 'direction'] as const) {
    const phases = readJsonFile<Record<string, boolean>>(S(slug, 'phases.json'), {});
    if (phases[phase]) continue;
    ctx.step(phase === 'photos' ? '① 사진 질문 준비' : '② 웹 방향 질문 준비');
    const r = await runClaude({ prompt: phasePrompt(slug, phase), schema: QuestionStep, slug, write: true, log: ctx.log, activity: ctx.activity });
    ctx.cost(r.costUsd);
    if (r.data.kind === 'questions' && r.data.questions?.length) {
      writeJsonFile(S(slug, 'next.json'), { phase, ...r.data });
      ctx.log(`· 질문 ${r.data.questions.length}개`);
      return;
    }
    writeJsonFile(S(slug, 'phases.json'), { ...phases, [phase]: true });
    ctx.log(`· ${phase === 'photos' ? '사진 질문' : '웹 방향'} 끝`);
  }
  if (!tripState(slug).planApproved) {
    ctx.step('③ 레이아웃 짜기');
    const r = await runClaude({ prompt: layoutPrompt(slug), schema: PlanStep, slug, write: true, log: ctx.log, activity: ctx.activity });
    ctx.cost(r.costUsd);
    writeJsonFile(S(slug, 'next.json'), { phase: 'layout', kind: 'plan', ...r.data });
    ctx.log(`· 배치표 ${r.data.plan.rows.length}개 섹션`);
    return;
  }
  await draft(ctx, slug, 'write');
}

/** ④ 초안: story.json → 파생 파일 → 경로·날씨 → 검증(오류면 Claude 가 고침) → 미리보기 → ⑤ 보완 질문 */
async function draft(ctx: Ctx, slug: string, mode: 'write' | 'rebuild') {
  if (mode === 'write') {
    ctx.step('④ 초안 쓰기');
    const r = await runClaude({ prompt: writePrompt(slug), schema: WriteResult, slug, write: true, log: ctx.log, activity: ctx.activity, timeoutMs: 30 * 60_000 });
    ctx.cost(r.costUsd);
    ctx.log(`· ${r.data.title} — 섹션 ${r.data.sections}개. ${r.data.summary}`);
  }
  ctx.step('사진·영상 변환');
  await tf(ctx, 'media', slug);
  const story = readJsonFile<{ sections: { template: string }[] }>(storyPath(slug), { sections: [] });
  if (story.sections.some((s) => s.template === 'map-journey')) {
    ctx.step('지도 경로');
    await tf(ctx, 'routes', slug);
  }
  if (story.sections.some((s) => s.template === 'weather-card')) {
    ctx.step('날씨 기록');
    await tf(ctx, 'weather', slug);
  }
  for (let attempt = 0; ; attempt++) {
    ctx.step('검증');
    try {
      await tf(ctx, 'validate', slug);
      break;
    } catch (e) {
      if (attempt >= 2) throw e;
      ctx.step('검증 오류 고치기');
      const errors = (e as Error).message.split('\n').filter((l) => l.includes('✗')).join('\n');
      const r = await runClaude({ prompt: fixPrompt(slug, errors), schema: WriteResult, slug, write: true, log: ctx.log, activity: ctx.activity });
      ctx.cost(r.costUsd);
      await tf(ctx, 'media', slug);
    }
  }
  await buildPreview(ctx, slug);
  ctx.step('⑤ 보완 질문 찾기');
  const g = await runClaude({ prompt: gapsPrompt(slug), schema: QuestionStep, slug, write: true, log: ctx.log, activity: ctx.activity });
  ctx.cost(g.costUsd);
  const questions = g.data.kind === 'questions' ? (g.data.questions ?? []) : [];
  writeJsonFile(S(slug, 'gaps.json'), { message: g.data.message, questions });
  ctx.log(questions.length ? `· 보완 질문 ${questions.length}개` : '· 보완할 곳 없음');
}

/** 게시본과 같은 렌더러로 정적 빌드 (초안 포함) — studio 가 /preview/ 아래로 내보낸다 */
async function buildPreview(ctx: Ctx, slug: string) {
  ctx.step('미리보기 만들기');
  await ctx.sh('npm', ['run', '-s', 'build'], { NEXT_PUBLIC_BASE_PATH: '/preview', TALEFRAME_SHOW_DRAFTS: '1', NEXT_PUBLIC_SITE_URL: SITE_URL });
  if (!fs.existsSync(path.join(OUT, 'stories', slug, 'index.html'))) throw new Error('미리보기 페이지가 만들어지지 않았다');
  writeJsonFile(S(slug, 'preview.json'), { builtAt: Date.now(), key: contentKey(storyPath(slug)) });
}

export function startPrepare(slug: string) {
  return startJob(slug, 'prepare', '정리·훑어보기', async (ctx) => {
    const s = tripState(slug);
    if (!s.scanned || s.needsScan) {
      ctx.step('정리 (촬영 시각순 정렬·썸네일)');
      await tf(ctx, 'scan', path.join('work', slug, 'inbox'), '--slug', slug);
    }
    const inv = readJsonFile<Inventory>(P(slug, 'inventory.json'), { items: [], skipped: [] });
    // travel-plan 에 적어 둔 계획이 있으면 사진마다 일정을 맞춘다 — 없거나 설정이 없으면 건너뛰고 예전처럼 묻는다
    if (!s.scanned || s.needsScan || !fs.existsSync(P(slug, 'plan-matches.json'))) {
      ctx.step('여행 계획 불러오기 (travel-plan)');
      await tf(ctx, 'plan', slug).catch((e: Error) => {
        const why = e.message.split('\n').find((l) => /설정|겹치는|여럿|연결|거부|travel-plan/.test(l)) ?? e.message.split('\n')[0];
        ctx.log(`· 계획 없이 진행: ${why.trim()}`);
      });
    }
    if (inv.items.some((i) => i.gps)) {
      ctx.step('장소 후보 찾기');
      await tf(ctx, 'places', slug);
    }
    ctx.step('사진 훑어보기');
    await analyze(ctx, slug);
    const after = tripState(slug);
    if (!after.pending && !after.story) await ask(ctx, slug);
  });
}

export function startAsk(slug: string) {
  return startJob(slug, 'ask', '다음 질문 준비', (ctx) => ask(ctx, slug));
}

/** ①② 질문의 답 → interview.json → 다음 질문 */
export function answer(slug: string, answers: Record<string, { choices?: string[]; text?: string }>) {
  const s = tripState(slug);
  const p = s.pending;
  if (!p || p.phase === 'layout') throw new Error('답할 질문이 없다');
  const log = [...s.interview];
  for (const q of p.questions ?? []) {
    log.push({ at: q.header, q: q.question, a: formatAnswer(answers[q.id]), phase: p.phase, media: q.media });
  }
  writeJsonFile(P(slug, 'interview.json'), log);
  fs.rmSync(S(slug, 'next.json'), { force: true });
  return startAsk(slug);
}

function formatAnswer(a?: { choices?: string[]; text?: string }) {
  const parts = [a?.choices?.length ? a.choices.join(', ') : '', a?.text?.trim() ? `(직접) ${a.text.trim()}` : ''].filter(Boolean);
  return parts.join(' / ') || '(건너뜀)';
}

/** ③ 레이아웃 승인 → ④ 초안, 수정 요청 → 다시 짜기 */
export function decidePlan(slug: string, approve: boolean, text: string) {
  const s = tripState(slug);
  if (s.pending?.phase !== 'layout') throw new Error('승인할 배치표가 없다');
  const plan = s.pending.plan;
  const log = [...s.interview, { at: 'plan', q: plan.title, a: approve ? '승인' : `수정 요청: ${text}`, phase: 'layout', ...(approve ? { plan } : {}) }];
  writeJsonFile(P(slug, 'interview.json'), log);
  fs.rmSync(S(slug, 'next.json'), { force: true });
  return approve
    ? startJob(slug, 'draft', '초안 만들기', (ctx) => draft(ctx, slug, 'write'))
    : startJob(slug, 'ask', '배치표 다시 짜기', (ctx) => ask(ctx, slug));
}

export function startDraft(slug: string) {
  const s = tripState(slug);
  return startJob(slug, 'draft', '초안 만들기', (ctx) => draft(ctx, slug, s.story ? 'rebuild' : 'write'));
}

/**
 * 초안 확인: 승인한 섹션은 approved, 보완 질문의 답과 섹션별 수정 요청이 있으면 초안을 고쳐 다시 만든다.
 * "전체 승인"이면 남은 보완 질문은 비워 둔 채 끝낸다.
 */
export function review(
  slug: string,
  input: { approve: string[]; requests: { section: string; text: string }[]; answers: Record<string, { choices?: string[]; text?: string }>; all: boolean },
) {
  const s = tripState(slug);
  const sp = storyPath(slug);
  const story = readJsonFile<{ sections: { id: string; status: string; memo?: string }[] }>(sp, { sections: [] });
  const reqs = input.requests.filter((r) => r.text.trim());
  const gapQs = s.gaps?.questions ?? [];
  const answered = gapQs
    .filter((q) => input.answers[q.id] && formatAnswer(input.answers[q.id]) !== '(건너뜀)')
    .map((q) => ({ section: q.section, q: q.question, a: formatAnswer(input.answers[q.id]) }));
  const touched = new Set([...reqs.map((r) => r.section), ...answered.map((a) => a.section ?? '')]);
  const approve = input.all ? story.sections.map((x) => x.id).filter((id) => !touched.has(id)) : input.approve;
  for (const sec of story.sections) if (approve.includes(sec.id)) sec.status = 'approved';
  writeJsonFile(sp, story);
  if (answered.length) {
    const log = [...s.interview, ...answered.map((a) => ({ at: a.section ?? '보완', q: a.q, a: a.a, phase: 'gaps' }))];
    writeJsonFile(P(slug, 'interview.json'), log);
  }
  if (input.all && !reqs.length && !answered.length) fs.rmSync(S(slug, 'gaps.json'), { force: true });
  if (!reqs.length && !answered.length) return null;
  return startJob(slug, 'revise', '초안 고치기', async (ctx) => {
    ctx.step('답과 요청 반영');
    const r = await runClaude({ prompt: revisePrompt(slug, reqs, answered), schema: ReviseResult, slug, write: true, log: ctx.log, activity: ctx.activity });
    ctx.cost(r.costUsd);
    ctx.log(`· ${r.data.summary}`);
    for (const sk of r.data.skipped) ctx.log(`· 못 고침: ${sk}`);
    await draft(ctx, slug, 'rebuild');
  });
}

export function publish(slug: string) {
  return startJob(slug, 'publish', '게시', async (ctx) => {
    const sp = storyPath(slug);
    const story = readJsonFile<{ status: string; title: string; updatedAt: string; sections: { status: string }[] }>(sp, {
      status: 'draft',
      title: slug,
      updatedAt: '',
      sections: [],
    });
    if (!story.sections.every((s) => s.status === 'approved')) throw new Error('승인하지 않은 섹션이 있다');
    story.status = 'published';
    story.updatedAt = new Date().toISOString().slice(0, 10);
    writeJsonFile(sp, story);
    ctx.step('검증');
    await tf(ctx, 'validate', slug);
    // 순서가 중요하다: media 브랜치 먼저, main 푸시 나중 (워크플로가 media 를 확인한다)
    ctx.step('사진·영상 올리기 (media 브랜치)');
    await tf(ctx, 'upload', slug);
    ctx.step('커밋·푸시');
    await ctx.sh('git', ['add', path.join('content', 'stories', slug)]);
    await ctx.sh('git', ['commit', '-m', `스토리 게시: ${story.title}\n\nTaleFrame Studio 에서 게시`]).catch((e: Error) => {
      if (!/nothing to commit/.test(e.message)) throw e;
    });
    await ctx.sh('git', ['push', 'origin', 'main']);
    const sha = (await ctx.sh('git', ['rev-parse', 'HEAD'])).trim();
    const commit = sha.slice(0, 7);
    ctx.step('배포 기다리기 (GitHub Actions)');
    const id = await findPagesRun(ctx, sha);
    if (id) await ctx.sh('gh', ['run', 'watch', id, '--exit-status', '--interval', '10']);
    else ctx.log('· 이 커밋의 배포 실행을 찾지 못했다 — 사이트 확인으로 넘어간다');
    ctx.step('배포된 사이트 확인');
    await tf(ctx, 'validate', slug, '--remote');
    const url = `${SITE_URL}/stories/${slug}/`;
    writeJsonFile(S(slug, 'published.json'), { at: new Date().toISOString(), url, commit });
    ctx.log(`✓ ${url}`);
  });
}

/**
 * 푸시한 커밋의 pages.yml 실행 id. 실행이 목록에 뜨기까지 몇 초 걸려 잠시 기다린다.
 * Ubuntu 의 gh 2.4 에는 `run list --branch/--commit` 이 없다 — headSha 로 직접 고른다.
 */
async function findPagesRun(ctx: Ctx, sha: string): Promise<string | null> {
  for (let i = 0; i < 12; i++) {
    const out = await ctx.sh('gh', ['run', 'list', '--workflow', 'pages.yml', '--limit', '10', '--json', 'databaseId,headSha']);
    const run = (JSON.parse(out) as { databaseId: number; headSha: string }[]).find((r) => r.headSha === sha);
    if (run) return String(run.databaseId);
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}
