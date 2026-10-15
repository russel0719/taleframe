import type { MediaEntry } from './story/schema';

/**
 * 파생 파일의 공개 URL.
 *
 * - NEXT_PUBLIC_MEDIA_BASE_URL 이 있으면 그것 (명시적 지정이 항상 이긴다)
 * - 프로덕션 + Supabase URL 이 있으면 Storage public 버킷 `taleframe`
 * - 그 외(로컬 개발)는 `tf media` 가 만든 public/media/ 를 그대로 쓴다
 */
export function mediaBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (process.env.NODE_ENV === 'production' && supabase && !supabase.includes('placeholder')) {
    return `${supabase.replace(/\/$/, '')}/storage/v1/object/public/taleframe`;
  }
  return '/media';
}

export const fileUrl = (slug: string, file: string) => `${mediaBaseUrl()}/${slug}/${file}`;

/** 파생 파일 이름 규칙 — scripts/lib/derive.ts 와 반드시 같아야 한다 (테스트로 묶여 있음) */
export const fileNames = {
  image: (base: string, w: number) => `${base}-${w}.webp`,
  poster: (base: string, w: number) => `${base}-poster-${w}.webp`,
  video: (base: string) => `${base}.mp4`,
  scrub: (base: string) => `${base}-scrub.mp4`,
  ambient: (base: string) => `${base}-ambient.m4a`,
  og: (base: string) => `${base}-og.jpg`,
};

export type ResolvedImage = {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  /** CSS object-position */
  position: string;
  thumbhash: string;
  alt: string;
};

export function resolveImage(slug: string, m: MediaEntry, alt = '', focus?: [number, number]): ResolvedImage {
  const name = m.kind === 'video' ? fileNames.poster : fileNames.image;
  const widths = [...m.widths].sort((a, b) => a - b);
  const [fx, fy] = focus ?? m.focus;
  return {
    src: fileUrl(slug, name(m.base, widths[Math.min(1, widths.length - 1)])),
    srcSet: widths.map((w) => `${fileUrl(slug, name(m.base, w))} ${w}w`).join(', '),
    width: m.width,
    height: m.height,
    position: `${(fx * 100).toFixed(1)}% ${(fy * 100).toFixed(1)}%`,
    thumbhash: m.thumbhash,
    alt,
  };
}

/** 가장 큰 파생 이미지 (라이트박스·파노라마용) */
export function largestImage(slug: string, m: MediaEntry): string {
  const name = m.kind === 'video' ? fileNames.poster : fileNames.image;
  return fileUrl(slug, name(m.base, Math.max(...m.widths)));
}
