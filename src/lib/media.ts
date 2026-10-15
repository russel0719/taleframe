import type { MediaEntry } from './story/schema';

/** GitHub Pages 프로젝트 사이트의 경로 접두사 (예: "/taleframe"). 로컬은 빈 문자열 */
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/$/, '');

/**
 * 파생 파일의 공개 URL.
 *
 * - NEXT_PUBLIC_MEDIA_BASE_URL 이 있으면 그것 (다른 호스트로 옮길 때)
 * - 그 외에는 사이트 안의 /media — 로컬은 `tf media` 가 만든 public/media/,
 *   배포는 GitHub Actions 가 `media` 브랜치를 public/media/ 에 받아 함께 내보낸다
 */
export function mediaBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  return `${basePath}/media`;
}

export const fileUrl = (slug: string, file: string) => `${mediaBaseUrl()}/${slug}/${file}`;

/** 파생 파일 이름 규칙 — scripts/lib/derive.ts 와 반드시 같아야 한다 (테스트로 묶여 있음) */
export type ImageFormat = 'avif' | 'webp';

export const fileNames = {
  image: (base: string, w: number, f: ImageFormat = 'webp') => `${base}-${w}.${f}`,
  poster: (base: string, w: number, f: ImageFormat = 'webp') => `${base}-poster-${w}.${f}`,
  video: (base: string) => `${base}.mp4`,
  scrub: (base: string) => `${base}-scrub.mp4`,
  ambient: (base: string) => `${base}-ambient.m4a`,
  og: (base: string) => `${base}-og.jpg`,
};

export type ResolvedImage = {
  src: string;
  srcSet: string;
  /** 'image/avif' 면 <picture> 로 감싸 fallback(webp) 을 둔다 */
  type: 'image/avif' | 'image/webp';
  /** AVIF 를 못 읽는 브라우저용 webp 한 장 */
  fallback?: string;
  width: number;
  height: number;
  /** CSS object-position */
  position: string;
  thumbhash: string;
  alt: string;
};

export function resolveImage(slug: string, m: MediaEntry, alt = '', focus?: [number, number]): ResolvedImage {
  const name = m.kind === 'video' ? fileNames.poster : fileNames.image;
  const f: ImageFormat = m.format ?? 'webp';
  const widths = [...m.widths].sort((a, b) => a - b);
  const [fx, fy] = focus ?? m.focus;
  return {
    src: fileUrl(slug, name(m.base, widths[Math.min(1, widths.length - 1)], f)),
    srcSet: widths.map((w) => `${fileUrl(slug, name(m.base, w, f))} ${w}w`).join(', '),
    type: f === 'avif' ? 'image/avif' : 'image/webp',
    fallback: f === 'avif' ? fileUrl(slug, name(m.base, widths[0], 'webp')) : undefined,
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
  return fileUrl(slug, name(m.base, Math.max(...m.widths), m.format ?? 'webp'));
}
