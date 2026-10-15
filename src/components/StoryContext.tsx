'use client';

import dynamic from 'next/dynamic';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ClientMedia, MediaMap } from '@/lib/resolve';

export type LightboxSlide = { media: ClientMedia; caption?: string };

type Ctx = {
  slug: string;
  media: MediaMap;
  openLightbox: (slides: LightboxSlide[], index: number) => void;
};

const StoryCtx = createContext<Ctx | null>(null);

// 라이트박스는 처음 열 때만 받는다
const Lightbox = dynamic(() => import('./Lightbox'), { ssr: false });

export function StoryProvider({ slug, media, children }: { slug: string; media: MediaMap; children: ReactNode }) {
  const [box, setBox] = useState<{ slides: LightboxSlide[]; index: number } | null>(null);
  const openLightbox = useCallback((slides: LightboxSlide[], index: number) => setBox({ slides, index }), []);
  const value = useMemo(() => ({ slug, media, openLightbox }), [slug, media, openLightbox]);
  return (
    <StoryCtx.Provider value={value}>
      {children}
      {box && <Lightbox slides={box.slides} index={box.index} onClose={() => setBox(null)} />}
    </StoryCtx.Provider>
  );
}

/** 스토리 밖(목록 페이지)에서도 쓰는 컴포넌트용 */
export function useStoryOptional() {
  return useContext(StoryCtx);
}

export function useStory() {
  const c = useContext(StoryCtx);
  if (!c) throw new Error('StoryProvider 밖에서 사용');
  return c;
}

export function useMedia(id: string): ClientMedia;
export function useMedia(id: string | undefined): ClientMedia | undefined;
export function useMedia(id: string | undefined) {
  const { media } = useStory();
  if (!id) return undefined;
  const m = media[id];
  if (!m) throw new Error(`media.json 에 ${id} 가 없다`);
  return m;
}
