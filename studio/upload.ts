import fs from 'node:fs';
import path from 'node:path';
import { inboxDir } from './config';

/**
 * 폰 → PC 업로드 (travel-video-maker 에서 검증한 방식).
 * - 8MB 청크를 offset 과 함께 보낸다. 끊기면 서버가 가진 크기부터 이어 보낸다 (409 + 현재 크기)
 * - `.parts/<이름>.part` 로 받고 다 받으면 inbox/ 로 옮긴다 — 반쪽 파일이 스캔에 섞이지 않는다
 *   (scan 은 . 으로 시작하는 폴더를 건너뛴다)
 * - 같은 이름·같은 크기는 건너뛴다 — 앨범을 다시 고르는 일이 흔하다
 */
const MEDIA_EXT = /\.(jpe?g|png|heic|heif|webp|tiff?|mov|mp4|m4v)$/i;
export const MAX_BYTES = 4 * 1024 ** 3;

/** 경로 성분과 제어 문자를 떼어낸다: "../../a.jpg" → "a.jpg" */
export function safeName(name: string): string | null {
  const base = path.basename(name.replace(/\\/g, '/')).replace(/[\u0000-\u001f<>:"|?*]/g, '').trim();
  if (!base || base.startsWith('.') || !MEDIA_EXT.test(base)) return null;
  return base.slice(0, 160);
}

export function existing(slug: string, files: { name: string; size: number }[]) {
  const dir = inboxDir(slug);
  return files
    .filter((f) => {
      const n = safeName(f.name);
      if (!n) return false;
      const p = path.join(dir, n);
      return fs.existsSync(p) && fs.statSync(p).size === f.size;
    })
    .map((f) => f.name);
}

export type ChunkResult = { status: 'partial' | 'complete'; received: number } | { status: 'conflict'; received: number } | { status: 'invalid'; message: string };

export function writeChunk(slug: string, name: string, size: number, offset: number, data: Buffer): ChunkResult {
  const n = safeName(name);
  if (!n) return { status: 'invalid', message: '사진·영상 파일만 받는다' };
  if (!(size > 0 && size <= MAX_BYTES)) return { status: 'invalid', message: '크기가 이상하다' };
  const dir = inboxDir(slug);
  const parts = path.join(dir, '.parts');
  fs.mkdirSync(parts, { recursive: true });
  const part = path.join(parts, `${n}.part`);
  const have = fs.existsSync(part) ? fs.statSync(part).size : 0;
  if (offset !== have) return { status: 'conflict', received: have };
  if (offset + data.length > size) return { status: 'invalid', message: '선언한 크기보다 크다' };
  fs.appendFileSync(part, data);
  const now = offset + data.length;
  if (now === size) {
    fs.renameSync(part, path.join(dir, n));
    return { status: 'complete', received: now };
  }
  return { status: 'partial', received: now };
}

export function inboxStats(slug: string) {
  const dir = inboxDir(slug);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !f.startsWith('.') && MEDIA_EXT.test(f)) : [];
  let bytes = 0;
  let videos = 0;
  for (const f of files) {
    bytes += fs.statSync(path.join(dir, f)).size;
    if (/\.(mov|mp4|m4v)$/i.test(f)) videos++;
  }
  return { files, images: files.length - videos, videos, bytes };
}
