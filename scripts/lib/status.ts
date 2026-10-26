import fs from 'node:fs';
import path from 'node:path';
import { MediaManifest, RoutesFile, Story } from '@/lib/story/schema';
import { readJson, storyDir, workDir } from './common';
import type { Inventory } from './scan';

/**
 * 스토리가 어느 단계까지 왔는지 — 세션이 끊긴 뒤 이어서 할 때 가장 먼저 본다.
 * 단계: scan → analysis → places → interview → story.json → media → routes/weather → validate → shot → upload
 */
export function status(slug: string) {
  const w = workDir(slug);
  const d = storyDir(slug);
  const has = (p: string) => fs.existsSync(p);
  const line = (ok: boolean | null, label: string, detail = '') =>
    console.log(`  ${ok === null ? '·' : ok ? '✓' : '✗'} ${label.padEnd(14)} ${detail}`);

  console.log(`${slug}`);
  const inv = has(path.join(w, 'inventory.json')) ? readJson<Inventory>(path.join(w, 'inventory.json')) : null;
  line(!!inv, 'scan', inv ? `${inv.items.length}개 · ${inv.sourceDir}` : '`tf scan <폴더> --slug ...`');

  const analysis = has(path.join(w, 'analysis.json')) ? readJson<{ id: string }[]>(path.join(w, 'analysis.json')) : [];
  const total = inv?.items.length ?? 0;
  const seen = new Set(analysis.map((a) => a.id));
  const unseen = inv?.items.filter((it) => !seen.has(it.id)).map((it) => it.id) ?? [];
  line(total > 0 && unseen.length === 0, 'analysis', total ? `${seen.size}/${total}${unseen.length ? ` — 남은 것: ${unseen.slice(0, 8).join(' ')}${unseen.length > 8 ? ' …' : ''}` : ''}` : '');

  const planM = has(path.join(w, 'plan-matches.json'))
    ? readJson<{ trip: { title: string }; summary: Record<string, number> }>(path.join(w, 'plan-matches.json'))
    : null;
  line(
    planM ? true : null,
    'plan',
    planM
      ? `${planM.trip.title} — 확실 ${planM.summary.confident} · 어긋남 ${planM.summary.conflict} · 좌표만 ${planM.summary.place} · 근처 ${planM.summary.nearby}`
      : 'travel-plan 에 계획이 있으면 `tf plan` (설정: TRAVEL_PLAN_URL · TRAVEL_PLAN_TOKEN)',
  );

  const places = has(path.join(w, 'places.json')) ? readJson<{ lodging?: boolean }[]>(path.join(w, 'places.json')) : null;
  line(places ? true : null, 'places', places ? `${places.length}곳${places.some((p) => p.lodging) ? ` · 숙소 ${places.filter((p) => p.lodging).length}곳` : ''}` : 'GPS 가 있으면 `tf places`');

  const interview = has(path.join(w, 'interview.json')) ? readJson<{ at: string }[]>(path.join(w, 'interview.json')) : [];
  line(interview.length > 0, 'interview', interview.length ? `답 ${interview.length}개 · 마지막: ${interview[interview.length - 1].at}` : '');

  const storyPath = path.join(d, 'story.json');
  if (!has(storyPath)) {
    line(false, 'story.json', '아직 없다');
    return;
  }
  const parsed = Story.safeParse(readJson(storyPath));
  if (!parsed.success) {
    line(false, 'story.json', '스키마 오류 — `tf validate`');
    return;
  }
  const story = parsed.data;
  const by = (st: string) => story.sections.filter((s) => s.status === st).length;
  line(true, 'story.json', `[${story.status}] 섹션 ${story.sections.length}개 · 승인 ${by('approved')} · 초안 ${by('draft')} · 검토 필요 ${by('needs_review')}`);

  const mPath = path.join(d, 'media.json');
  const manifest = has(mPath) ? MediaManifest.parse(readJson(mPath)) : null;
  const mtime = (p: string) => (has(p) ? fs.statSync(p).mtimeMs : 0);
  line(
    manifest ? mtime(mPath) >= mtime(storyPath) || null : false,
    'media',
    manifest ? `${Object.keys(manifest.items).length}개${mtime(mPath) < mtime(storyPath) ? ' — story.json 이 더 새롭다, `tf validate` 로 최신인지 확인' : ''}` : '`tf media`',
  );

  const journeys = story.sections.filter((s) => s.template === 'map-journey').length;
  if (journeys) {
    const rPath = path.join(d, 'routes.json');
    const routes = has(rPath) ? RoutesFile.parse(readJson(rPath)) : {};
    line(Object.keys(routes).length >= journeys, 'routes', `${Object.keys(routes).length}/${journeys}`);
  }
  const shots = path.join(w, 'shots');
  line(has(shots) ? mtime(shots) >= mtime(storyPath) || null : false, 'shot', has(shots) ? (mtime(shots) < mtime(storyPath) ? 'story.json 이 바뀐 뒤 다시 찍지 않았다' : '최신') : '`npm run shot -- ' + slug + '`');
}
