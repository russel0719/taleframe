import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** 저장소 루트 — studio 는 scripts/ 와 같은 저장소의 코드·파일을 그대로 쓴다 */
export const ROOT = path.resolve(import.meta.dirname, '..');
export const WORK = path.join(ROOT, 'work');
export const STORIES = path.join(ROOT, 'content', 'stories');
export const OUT = path.join(ROOT, 'out');
/** 토큰 등 studio 자체 상태 — gitignore */
export const STATE = path.join(ROOT, '.studio');

export const PORT = Number(process.env.TALEFRAME_STUDIO_PORT ?? 8742);
export const SITE_URL = (process.env.TALEFRAME_SITE_URL ?? 'https://russel0719.github.io/taleframe').replace(/\/$/, '');
/** 질문 만들기·페이지 쓰기에 쓰는 모델 (비우면 Claude Code 기본값) */
export const MODEL = process.env.TALEFRAME_MODEL || undefined;
/** 사진 훑어보기는 장수가 많아 가벼운 모델로 */
export const ANALYZE_MODEL = process.env.TALEFRAME_ANALYZE_MODEL || 'sonnet';
/** 선택: 긴 작업이 끝나면 ntfy.sh/<topic> 으로 폰 알림 */
export const NTFY_TOPIC = process.env.TALEFRAME_NTFY_TOPIC || undefined;

/** 같은 와이파이의 다른 기기를 막는 토큰. PC 화면의 QR 로 한 번 들어오면 쿠키로 기억한다 */
export function token(): string {
  const file = path.join(STATE, 'token');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  fs.mkdirSync(STATE, { recursive: true });
  const t = crypto.randomBytes(18).toString('base64url');
  fs.writeFileSync(file, t, { mode: 0o600 });
  return t;
}

/** 폰이 붙을 LAN 주소 — WSL mirrored 모드면 PC 의 와이파이 주소와 같다 */
export function lanAddress(): string | undefined {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && /^(192\.168|10\.)/.test(a.address)) return a.address;
    }
  }
  return undefined;
}

export const slugDir = (slug: string) => path.join(WORK, slug);
export const studioDir = (slug: string) => path.join(WORK, slug, 'studio');
export const inboxDir = (slug: string) => path.join(WORK, slug, 'inbox');

export function readJsonFile<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
