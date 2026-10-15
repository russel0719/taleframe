import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { MediaManifest, RoutesFile, Story, WeatherFile, sectionSchemas, templateIds } from '@/lib/story/schema';
import { checkStory, type Issue } from '@/lib/story/validate';
import { catalog, collectUsage } from '@/templates/catalog';
import { STORIES, mediaDir, readJson, storyDir, workDir, writeJson, ROOT } from './common';
import { expectedFiles, hashFor } from './derive';
import { lodgingPoints, nearLodging } from './geo';
import type { Inventory } from './scan';
import { checkRemote } from './upload';

function formatZod(e: z.ZodError): Issue[] {
  return e.issues.map((i) => ({ level: 'error', where: i.path.join('.') || '(root)', message: i.message }));
}

export async function validate(slugs: string[], { remote = false } = {}) {
  if (!slugs.length) {
    slugs = fs.existsSync(STORIES) ? fs.readdirSync(STORIES).filter((d) => fs.existsSync(path.join(STORIES, d, 'story.json'))) : [];
  }
  let failed = false;
  for (const slug of slugs) {
    const dir = storyDir(slug);
    const issues: Issue[] = [];
    const parsed = Story.safeParse(readJson(path.join(dir, 'story.json')));
    if (!parsed.success) {
      issues.push(...formatZod(parsed.error));
    } else {
      const story = parsed.data;
      if (story.slug !== slug) issues.push({ level: 'error', where: 'slug', message: `디렉토리명(${slug})과 다르다` });
      let manifest: MediaManifest | undefined;
      const mPath = path.join(dir, 'media.json');
      if (fs.existsSync(mPath)) {
        const m = MediaManifest.safeParse(readJson(mPath));
        if (m.success) manifest = m.data;
        else issues.push(...formatZod(m.error).map((i) => ({ ...i, where: `media.json ${i.where}` })));
      } else {
        issues.push({ level: 'warning', where: 'media.json', message: `없다 — \`tf media ${slug}\`` });
      }
      const wPath = path.join(dir, 'weather.json');
      const weather = new Set(fs.existsSync(wPath) ? Object.keys(WeatherFile.parse(readJson(wPath))) : []);
      const rPath = path.join(dir, 'routes.json');
      const routes = Object.fromEntries(
        Object.entries(fs.existsSync(rPath) ? RoutesFile.parse(readJson(rPath)) : {}).map(([k, v]) => [k, v.key]),
      );
      issues.push(...checkStory(story, manifest, { weather, routes }));
      if (manifest) issues.push(...freshness(slug, story, manifest));
      issues.push(...privacy(slug, story));

      if (manifest) {
        if (remote) {
          for (const f of await checkRemote(slug)) issues.push({ level: 'error', where: 'storage', message: `원격에 없음: ${f}` });
        } else {
          const missing = Object.values(manifest.items)
            .flatMap(expectedFiles)
            .filter((f) => !fs.existsSync(path.join(mediaDir(slug), f)));
          if (missing.length) {
            issues.push({ level: 'warning', where: 'public/media', message: `로컬 파생 파일 ${missing.length}개 없음 — \`tf media ${slug}\`` });
          }
        }
      }

      console.log(`\n${slug} — ${story.title} [${story.status}]`);
      story.sections.forEach((s, i) => {
        const flags = [s.status !== 'approved' ? s.status : '', s.locked ? 'locked' : ''].filter(Boolean).join(' ');
        console.log(`  ${String(i + 1).padStart(2)}. ${s.template.padEnd(17)} ${s.id}${flags ? `  (${flags})` : ''}`);
      });
    }

    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');
    for (const i of errors) console.log(`  ✗ ${i.where}: ${i.message}`);
    for (const i of warnings) console.log(`  · ${i.where}: ${i.message}`);
    console.log(errors.length ? `  ✗ 오류 ${errors.length}개` : `  ✓ 통과${warnings.length ? ` (경고 ${warnings.length}개)` : ''}`);
    if (errors.length) failed = true;
  }
  if (failed) process.exit(1);
}

type JsonSchema = {
  type?: string;
  const?: unknown;
  enum?: unknown[];
  maxLength?: number;
  pattern?: string;
  format?: string;
  minItems?: number;
  maxItems?: number;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  anyOf?: JsonSchema[];
  prefixItems?: JsonSchema[];
};

/** JSON Schema → `{media: id, caption?: 문자≤80}[1-4]` 같은 한 줄 요약 */
function typeOf(s: JsonSchema): string {
  if (s.anyOf) return s.anyOf.map(typeOf).join(' | ');
  if (s.const !== undefined) return JSON.stringify(s.const);
  if (s.enum) return s.enum.map((e) => JSON.stringify(e)).join('|');
  if (s.type === 'string') {
    if (s.pattern?.startsWith('^m\\d')) return 'id';
    if (s.format === 'date') return 'YYYY-MM-DD';
    if (s.pattern?.includes('\\d{2}:\\d{2}')) return 'HH:MM';
    return s.maxLength ? `문자≤${s.maxLength}` : '문자';
  }
  if (s.type === 'number') return '숫자';
  if (s.type === 'boolean') return 'bool';
  if (s.type === 'array') {
    if (s.prefixItems) return `[${s.prefixItems.map(typeOf).join(', ')}]`;
    const range = s.minItems !== undefined || s.maxItems !== undefined ? `[${s.minItems ?? 0}-${s.maxItems ?? '∞'}]` : '[]';
    return `${typeOf(s.items ?? {})}${range}`;
  }
  if (s.type === 'object' && s.properties) {
    return `{${Object.entries(s.properties)
      .map(([k, v]) => `${k}${s.required?.includes(k) ? '' : '?'}: ${typeOf(v)}`)
      .join(', ')}}`;
  }
  return '?';
}

/**
 * media.json 이 지금의 story.json 과 맞는지 — 용도(스크럽·현장음·파노라마)를 바꾸거나 trim 을 고친 뒤
 * `tf media` 를 다시 안 돌리면 화면에 빈 영상·낡은 구간이 나간다
 */
function freshness(slug: string, story: Story, manifest: MediaManifest): Issue[] {
  const out: Issue[] = [];
  const stale = (id: string, why: string) =>
    out.push({ level: 'error', where: `media.${id}`, message: `${why} — \`tf media ${slug}\` 를 다시 돌린다` });
  for (const [id, u] of collectUsage(story.sections)) {
    const m = manifest.items[id];
    if (!m) continue;
    if (m.kind === 'video') {
      if (u.scrub && !m.scrub) stale(id, '스크럽 영상이 없다');
      if (u.ambient && !m.ambient) stale(id, '현장음 파일이 없다');
      if (u.regular && !m.mp4) stale(id, '재생용 mp4 가 없다');
    }
    if (u.panorama && Math.max(...m.widths) < 4096 && m.width >= 4096) stale(id, '파노라마용 큰 이미지가 없다');
  }
  const invPath = path.join(workDir(slug), 'inventory.json');
  if (fs.existsSync(invPath)) {
    const inv = readJson<Inventory>(invPath);
    const byId = new Map(inv.items.map((it) => [it.id, it]));
    for (const [id, m] of Object.entries(manifest.items)) {
      const it = byId.get(id);
      if (it && fs.existsSync(path.join(inv.sourceDir, it.file)) && m.base !== `${id}-${hashFor(it, inv.sourceDir, story.media?.[id])}`) {
        stale(id, '원본이나 trim 이 바뀌었다');
      }
    }
  }
  return out;
}

/** 숙소 후보 반경 안의 좌표가 공개되지 않는지 (work/<slug>/places.json 이 있을 때만) */
function privacy(slug: string, story: Story): Issue[] {
  const lodging = lodgingPoints(slug);
  if (!lodging.length) return [];
  const out: Issue[] = [];
  story.sections.forEach((s, i) => {
    const pts: [string, number, number][] = [];
    if (s.template === 'map-journey') s.stops.forEach((st, j) => pts.push([`stops[${j}]`, st.lng, st.lat]));
    if (s.template === 'weather-card') pts.push(['place', s.place.lng, s.place.lat]);
    if (s.template === 'globe-intro') pts.push(['target', s.target.lng, s.target.lat]);
    for (const [where, lng, lat] of pts) {
      if (nearLodging([lng, lat], lodging)) {
        out.push({ level: 'error', where: `sections[${i}] (${s.id}).${where}`, message: '숙소 후보 반경 안의 좌표다 — 공개하지 않는다' });
      }
    }
  });
  return out;
}

/** 스킬이 템플릿을 고를 때 읽는 카탈로그. 필드 목록은 zod 스키마에서 바로 뽑는다 */
export function printCatalog() {
  const BASE = new Set(['id', 'template', 'tone', 'status', 'locked', 'ambient', 'memo']);
  const lines: string[] = ['# 템플릿 카탈로그', '', '공통 필드: id, template, status, tone?, locked?, ambient?(현장음 영상 id | "none"), memo?(렌더링 안 됨)', ''];
  const byCat = new Map<string, typeof templateIds>();
  for (const id of templateIds) {
    const c = catalog[id].category;
    byCat.set(c, [...(byCat.get(c) ?? []), id]);
  }
  for (const [cat, ids] of byCat) {
    lines.push(`## ${cat}`, '');
    for (const id of ids) {
      const t = catalog[id];
      const js = z.toJSONSchema(sectionSchemas[id], { unrepresentable: 'any' }) as {
        properties: Record<string, unknown>;
        required?: string[];
      };
      const fields = Object.entries(js.properties)
        .filter(([k]) => !BASE.has(k))
        .map(([k, v]) => `${k}${js.required?.includes(k) ? '' : '?'}: ${typeOf(v as JsonSchema)}`);
      lines.push(`### \`${id}\` — ${t.name}`);
      lines.push(t.description);
      lines.push(`- 어울림: ${t.suitableFor.join(' / ')}`);
      if (t.avoidWhen) lines.push(`- 피함: ${t.avoidWhen.join(' / ')}`);
      lines.push(`- 필드: ${fields.join(', ')}`);
      lines.push(`- 모션: ${t.motionLevel} · 기본 톤: ${t.defaultTone}${t.tall ? ' · 긴 스크롤 장면' : ''}`, '');
    }
  }
  console.log(lines.join('\n'));
}

/** 에디터 자동완성용 JSON Schema */
export function writeSchema() {
  const file = path.join(ROOT, 'content', 'story.schema.json');
  writeJson(file, z.toJSONSchema(Story, { unrepresentable: 'any' }));
  console.log(`✓ ${path.relative(process.cwd(), file)}`);
}
