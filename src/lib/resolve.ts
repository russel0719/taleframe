import { fileNames, fileUrl, resolveImage, type ResolvedImage } from './media';
import type { MediaManifest, Story } from './story/schema';

/** 클라이언트 템플릿이 받는 미디어 — 직렬화 가능한 URL 묶음 */
export type ClientMedia = {
  id: string;
  kind: 'image' | 'video';
  width: number;
  height: number;
  /** 사진이면 사진, 영상이면 포스터 */
  img: ResolvedImage;
  /** 라이트박스용 전체 해상도 후보 */
  full: { src: string; width: number; height: number; srcSet: { src: string; width: number; height: number }[] };
  video?: { src?: string; scrub?: string; ambient?: string; duration: number; hasAudio: boolean };
  /** node-vibrant 팔레트 (Vibrant, Muted, DarkVibrant, DarkMuted, LightVibrant, LightMuted) */
  palette: Record<string, string>;
  /** 촬영 현지 시각 "YYYY-MM-DDTHH:MM" */
  taken?: string;
};
export type MediaMap = Record<string, ClientMedia>;

export function resolveAll(story: Story, manifest: MediaManifest): MediaMap {
  const out: MediaMap = {};
  for (const [id, m] of Object.entries(manifest.items)) {
    const opt = story.media?.[id];
    const img = resolveImage(story.slug, m, opt?.alt ?? '', opt?.focus);
    const name = m.kind === 'video' ? fileNames.poster : fileNames.image;
    const srcSet = [...m.widths]
      .sort((a, b) => a - b)
      .map((w) => ({ src: fileUrl(story.slug, name(m.base, w)), width: w, height: Math.round((w * m.height) / m.width) }));
    out[id] = {
      id,
      kind: m.kind,
      width: m.width,
      height: m.height,
      img,
      full: { ...srcSet[srcSet.length - 1], srcSet },
      palette: m.palette ?? {},
      taken: m.taken,
      ...(m.kind === 'video'
        ? {
            video: {
              src: m.mp4 ? fileUrl(story.slug, fileNames.video(m.base)) : undefined,
              scrub: m.scrub ? fileUrl(story.slug, fileNames.scrub(m.base)) : undefined,
              ambient: m.ambient ? fileUrl(story.slug, fileNames.ambient(m.base)) : undefined,
              duration: m.duration ?? 0,
              hasAudio: m.hasAudio ?? false,
            },
          }
        : {}),
    };
  }
  return out;
}

/**
 * 섹션별 실제로 깔릴 현장음. 섹션이 ambient 를 지정하면 다음 지정이 나올 때까지 이어지고,
 * 'none' 이면 끊긴다.
 */
export function ambientPlan(story: Story, media: MediaMap): (string | null)[] {
  let current: string | null = null;
  return story.sections.map((s) => {
    if (s.ambient === 'none') current = null;
    else if (s.ambient) current = media[s.ambient]?.video?.ambient ?? null;
    return current;
  });
}
