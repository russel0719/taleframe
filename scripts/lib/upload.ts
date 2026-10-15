import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { MediaManifest } from '@/lib/story/schema';
import { fail, loadEnv, mediaDir, pool, readJson, storyDir } from './common';
import { expectedFiles } from './derive';

export const BUCKET = 'taleframe';

const CONTENT_TYPE: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
};

export function manifestFiles(slug: string): string[] {
  const manifest = MediaManifest.parse(readJson(path.join(storyDir(slug), 'media.json')));
  return Object.values(manifest.items).flatMap(expectedFiles);
}

function client() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail('.env.local 에 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요하다');
  return { url, sb: createClient(url, key, { auth: { persistSession: false } }) };
}

/**
 * public/media/<slug>/ 의 파생 파일을 Storage 에 올린다.
 * 파일명에 내용 해시가 들어 있어 덮어쓸 일이 없으므로 이미 있는 파일은 건너뛰고, 캐시는 1년으로 둔다.
 */
export async function upload(slug: string, { prune = false } = {}) {
  const { sb } = client();
  const { data: bucket } = await sb.storage.getBucket(BUCKET);
  if (!bucket) fail(`버킷 '${BUCKET}' 이 없다 — supabase/migrations 의 버킷 마이그레이션을 먼저 적용한다`);
  if (!bucket.public) fail(`버킷 '${BUCKET}' 이 public 이 아니다`);

  const files = manifestFiles(slug);
  const dir = mediaDir(slug);
  const missingLocal = files.filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missingLocal.length) fail(`로컬 파생 파일이 없다 (${missingLocal.length}개) — \`tf media ${slug}\` 를 먼저`);

  const remote = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.storage.from(BUCKET).list(slug, { limit: 1000, offset });
    if (error) fail(`목록 조회 실패: ${error.message}`);
    data.forEach((o) => remote.add(o.name));
    if (data.length < 1000) break;
  }

  const todo = files.filter((f) => !remote.has(f));
  console.log(`· 업로드 ${todo.length}개 (이미 있음 ${files.length - todo.length}개)`);
  let bytes = 0;
  await pool(todo, 4, async (f) => {
    const body = fs.readFileSync(path.join(dir, f));
    const { error } = await sb.storage.from(BUCKET).upload(`${slug}/${f}`, body, {
      contentType: CONTENT_TYPE[path.extname(f)] ?? 'application/octet-stream',
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw new Error(`${f}: ${error.message}`);
    bytes += body.length;
    process.stdout.write(`  ✓ ${f}\n`);
  });

  const stale = [...remote].filter((f) => !files.includes(f));
  if (stale.length) {
    if (prune) {
      const { error } = await sb.storage.from(BUCKET).remove(stale.map((f) => `${slug}/${f}`));
      if (error) fail(`정리 실패: ${error.message}`);
      console.log(`· 쓰지 않는 원격 파일 ${stale.length}개 삭제`);
    } else {
      console.log(`· 쓰지 않는 원격 파일 ${stale.length}개 — 지우려면 --prune`);
    }
  }
  console.log(`✓ ${(bytes / 1024 / 1024).toFixed(1)}MB 업로드`);
}

/** 배포된 URL 에서 실제로 받아지는지 확인 */
export async function checkRemote(slug: string): Promise<string[]> {
  const { url } = client();
  const base = `${url.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${slug}`;
  const missing: string[] = [];
  await pool(manifestFiles(slug), 8, async (f) => {
    const res = await fetch(`${base}/${f}`, { method: 'HEAD' });
    if (!res.ok) missing.push(`${f} (${res.status})`);
  });
  return missing;
}
