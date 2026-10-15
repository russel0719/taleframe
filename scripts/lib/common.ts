import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const STORIES = path.join(ROOT, 'content', 'stories');
/** 작업 상태 (원본 경로·GPS 포함) — gitignore. 절대 배포되지 않는다 */
export const WORK = path.join(ROOT, 'work');
/** 로컬 미리보기용 파생 파일 — gitignore. 배포는 Supabase Storage 로 */
export const PUBLIC_MEDIA = path.join(ROOT, 'public', 'media');

export const storyDir = (slug: string) => path.join(STORIES, slug);
export const workDir = (slug: string) => path.join(WORK, slug);
export const mediaDir = (slug: string) => path.join(PUBLIC_MEDIA, slug);

export const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
export const FFPROBE = process.env.FFPROBE ?? 'ffprobe';

export function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) process.loadEnvFile(p);
  }
}

export function readJson<T = unknown>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function run(cmd: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const errOut: Buffer[] = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => errOut.push(d));
    p.on('error', (e) =>
      reject(e.message.includes('ENOENT') ? new Error(`${cmd} 를 찾을 수 없다 — PATH 또는 ${cmd.toUpperCase()} 환경변수 확인`) : e),
    );
    p.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(new Error(`${cmd} 실패 (${code}): ${Buffer.concat(errOut).toString().slice(-800)}`)),
    );
  });
}

export function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 동시 실행 수를 제한한 map */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}
