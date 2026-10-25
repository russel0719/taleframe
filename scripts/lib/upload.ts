import fs from 'node:fs';
import path from 'node:path';
import { MediaManifest } from '@/lib/story/schema';
import { ROOT, STORIES, fail, mediaDir, pool, readJson, run, storyDir } from './common';
import { expectedFiles } from './derive';

/**
 * 파생 파일을 같은 저장소의 `media` 브랜치에 올린다 (GitHub Pages 배포의 "B 방법").
 *
 * - main 에는 코드와 story.json 만, 사진·영상은 `media` 브랜치에만 둔다
 * - `media` 브랜치는 항상 커밋 하나다 (올릴 때마다 orphan 커밋으로 다시 만들어 강제 푸시).
 *   그래서 미디어를 다시 만들어도 옛 파일이 히스토리에 쌓이지 않는다
 * - 배포 워크플로(.github/workflows/pages.yml)가 이 브랜치를 public/media/ 에 받아 사이트와 함께 내보낸다
 *
 * 작업 폴더는 저장소 안의 `.media-repo/` (gitignore). 다른 스토리의 파일은 원격에서 받아 그대로 둔다.
 * 단, content/stories/ 에 없는 스토리 폴더(지웠거나 `tf rename` 으로 주소를 바꾼 것)는 지운다.
 */
export const MEDIA_BRANCH = 'media';
const MEDIA_REPO = path.join(ROOT, '.media-repo');
/** GitHub Pages 사이트 상한 1GB 에서 사이트 코드·여유분을 뺀 값 */
const WARN_BYTES = 850 * 1024 * 1024;

const git = async (args: string[], cwd = MEDIA_REPO) => (await run('git', args, cwd)).toString().trim();

export function manifestFiles(slug: string): string[] {
  const manifest = MediaManifest.parse(readJson(path.join(storyDir(slug), 'media.json')));
  return Object.values(manifest.items).flatMap(expectedFiles);
}

async function originUrl() {
  try {
    return await git(['remote', 'get-url', 'origin'], ROOT);
  } catch {
    fail('GitHub 원격(origin)이 없다 — 저장소를 만들고 `git remote add origin ...` 부터 한다');
  }
}

/** https://github.com/<owner>/<repo>(.git) → https://<owner>.github.io/<repo> */
export async function pagesUrl(): Promise<string> {
  if (process.env.TALEFRAME_SITE_URL) return process.env.TALEFRAME_SITE_URL.replace(/\/$/, '');
  const m = (await originUrl()).match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/);
  if (!m) fail('origin 이 GitHub 저장소가 아니다 — TALEFRAME_SITE_URL 로 사이트 주소를 지정한다');
  return `https://${m[1].toLowerCase()}.github.io/${m[2]}`;
}

function dirBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).reduce((n, d) => {
    if (d.name === '.git') return n;
    const p = path.join(dir, d.name);
    return n + (d.isDirectory() ? dirBytes(p) : fs.statSync(p).size);
  }, 0);
}

async function prepareRepo() {
  const origin = await originUrl();
  if (!fs.existsSync(path.join(MEDIA_REPO, '.git'))) {
    fs.mkdirSync(MEDIA_REPO, { recursive: true });
    await git(['init', '-q']);
    await git(['remote', 'add', 'origin', origin]);
  } else {
    await git(['remote', 'set-url', 'origin', origin]);
  }
  // 원격의 최신 media 브랜치를 받아 다른 스토리 파일을 보존한다 (없으면 빈 상태에서 시작)
  try {
    await git(['fetch', '-q', '--depth', '1', 'origin', MEDIA_BRANCH]);
    await git(['checkout', '-q', '--detach', 'FETCH_HEAD']);
    await git(['reset', '-q', '--hard', 'FETCH_HEAD']);
    await git(['clean', '-q', '-fdx']);
  } catch {
    console.log(`· 원격에 ${MEDIA_BRANCH} 브랜치가 아직 없다 — 새로 만든다`);
  }
}

export async function upload(slug: string, { deploy = false } = {}) {
  const files = manifestFiles(slug);
  const src = mediaDir(slug);
  const missing = files.filter((f) => !fs.existsSync(path.join(src, f)));
  if (missing.length) fail(`로컬 파생 파일이 없다 (${missing.length}개) — \`tf media ${slug}\` 를 먼저`);

  await prepareRepo();
  let pruned = 0;
  for (const d of fs.readdirSync(MEDIA_REPO, { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('.') || fs.existsSync(path.join(STORIES, d.name))) continue;
    fs.rmSync(path.join(MEDIA_REPO, d.name), { recursive: true });
    console.log(`· 없는 스토리의 폴더 정리: ${d.name}/`);
    pruned++;
  }
  const dst = path.join(MEDIA_REPO, slug);
  fs.mkdirSync(dst, { recursive: true });

  // 이 스토리 폴더를 media.json 과 정확히 같게 — 해시 이름이라 이름이 같으면 내용도 같다
  const keep = new Set(files);
  let added = 0;
  let removed = 0;
  for (const f of fs.readdirSync(dst)) {
    if (!keep.has(f)) {
      fs.rmSync(path.join(dst, f));
      removed++;
    }
  }
  for (const f of files) {
    if (!fs.existsSync(path.join(dst, f))) {
      fs.copyFileSync(path.join(src, f), path.join(dst, f));
      added++;
    }
  }
  fs.writeFileSync(
    path.join(MEDIA_REPO, 'README.md'),
    '# TaleFrame media\n\n`tf upload` 가 만드는 브랜치다. 손으로 고치지 않는다.\n' +
      '항상 커밋 하나로 다시 만들어 강제 푸시하므로 히스토리가 쌓이지 않는다.\n',
  );

  const total = dirBytes(MEDIA_REPO);
  console.log(`· ${slug}: 추가 ${added} · 삭제 ${removed} · 브랜치 전체 ${(total / 1048576).toFixed(1)}MB`);
  if (total > WARN_BYTES) {
    console.log('  ⚠ GitHub Pages 사이트 상한(1GB)에 가깝다 — 오래된 스토리 정리나 다른 호스팅을 검토한다');
  }
  if (!added && !removed && !pruned) {
    console.log('✓ 바뀐 파일이 없다 — 푸시하지 않는다');
  } else {
    // 커밋 하나짜리 orphan 브랜치로 다시 만든다
    await git(['checkout', '-q', '--orphan', 'tf-media-tmp']);
    await git(['add', '-A']);
    await git(['commit', '-q', '-m', `media: ${slug} (${new Date().toISOString().slice(0, 10)})`]);
    await git(['branch', '-q', '-M', MEDIA_BRANCH]);
    await git(['push', '-q', '--force', 'origin', MEDIA_BRANCH]);
    console.log(`✓ ${MEDIA_BRANCH} 브랜치 강제 푸시 (커밋 1개)`);
  }

  if (deploy) {
    // main 에 아무것도 안 바뀌었을 때만 필요하다 — 보통은 story.json 을 main 에 푸시하면 배포가 돈다
    await run('gh', ['workflow', 'run', 'pages.yml', '--ref', 'main'], ROOT);
    console.log('✓ 배포 워크플로 실행 요청 (gh workflow run pages.yml)');
  }
}

/** 배포된 사이트에서 실제로 받아지는지 */
export async function checkRemote(slug: string): Promise<string[]> {
  const base = `${await pagesUrl()}/media/${slug}`;
  const missing: string[] = [];
  await pool(manifestFiles(slug), 8, async (f) => {
    const res = await fetch(`${base}/${f}`, { method: 'HEAD' });
    if (!res.ok) missing.push(`${f} (${res.status})`);
  });
  return missing;
}
