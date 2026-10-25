import fs from 'node:fs';
import path from 'node:path';
import { ROOT, WORK, fail, mediaDir, readJson, storyDir, workDir, writeJson } from './common';

/**
 * 스토리 주소(slug) 바꾸기.
 *
 * - 로컬 세 곳(content/stories · work · public/media)을 옮기고 story.json 의 slug 와 work 안의 경로를 고친다
 * - `content/redirects.json` 에 옛 주소 → 새 주소를 남긴다. 빌드가 옛 주소에 넘겨 주는 페이지를 만든다
 *   (공유한 링크가 깨지지 않게)
 * - 게시본 반영은 따로: `tf upload <새 slug>` (media 브랜치의 옛 폴더는 upload 가 정리) → main 커밋·푸시
 */
export const REDIRECTS = path.join(ROOT, 'content', 'redirects.json');
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function readRedirects(): Record<string, string> {
  return fs.existsSync(REDIRECTS) ? readJson<Record<string, string>>(REDIRECTS) : {};
}

/** 옛 주소 → 새 주소. 예전에 옛 주소로 가던 것도 새 주소로 바로 가게 하고, 되돌린 이름은 지운다 */
export function addRedirect(map: Record<string, string>, from: string, to: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) if (k !== to) next[k] = v === from ? to : v;
  next[from] = to;
  return Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
}

function rewriteJsonFiles(dir: string, from: string, to: string): number {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'inbox' && e.name !== 'thumbs' && e.name !== 'sheets') n += rewriteJsonFiles(p, from, to);
    } else if (e.name.endsWith('.json')) {
      const s = fs.readFileSync(p, 'utf8');
      const t = s
        .replaceAll(`${path.join(WORK, from)}/`, `${path.join(WORK, to)}/`)
        .replaceAll(`"work/${from}/`, `"work/${to}/`)
        .replaceAll(`/stories/${from}/`, `/stories/${to}/`)
        .replace(new RegExp(`("slug":\\s*)"${from}"`, 'g'), `$1"${to}"`);
      if (t !== s) {
        fs.writeFileSync(p, t);
        n++;
      }
    }
  }
  return n;
}

export function rename(from: string, to: string) {
  if (!SLUG.test(to)) fail(`새 주소는 영문 소문자·숫자 kebab-case 여야 한다: ${to}`);
  const dirs = [storyDir, workDir, mediaDir];
  if (!dirs.some((d) => fs.existsSync(d(from)))) fail(`${from} 스토리가 없다`);
  for (const d of dirs) if (fs.existsSync(d(to))) fail(`${path.relative(ROOT, d(to))} 가 이미 있다`);

  for (const d of dirs) {
    if (!fs.existsSync(d(from))) continue;
    fs.renameSync(d(from), d(to));
    console.log(`· ${path.relative(ROOT, d(from))} → ${path.relative(ROOT, d(to))}`);
  }
  const sp = path.join(storyDir(to), 'story.json');
  if (fs.existsSync(sp)) {
    const story = readJson<{ slug: string }>(sp);
    story.slug = to;
    writeJson(sp, story);
  }
  if (fs.existsSync(workDir(to))) console.log(`· work 안의 경로 고침: 파일 ${rewriteJsonFiles(workDir(to), from, to)}개`);

  writeJson(REDIRECTS, addRedirect(readRedirects(), from, to));
  console.log(`✓ ${from} → ${to} (content/redirects.json 에 옛 주소를 남겼다)`);
  console.log(`  게시본에 반영: npm run tf -- upload ${to} → content/ 를 main 에 커밋·푸시`);
}
