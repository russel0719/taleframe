'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Howl } from 'howler';

/**
 * 섹션마다 지정된 현장음을 스크롤 위치에 맞춰 교차 재생한다.
 * 기본은 꺼짐 — 소리는 반드시 사용자가 켠다. howler 는 켤 때 처음 받는다.
 */
type Ctx = { available: boolean; enabled: boolean; toggle: () => void };
const SoundCtx = createContext<Ctx>({ available: false, enabled: false, toggle: () => {} });
export const useSoundscape = () => useContext(SoundCtx);

const VOLUME = 0.6;
const DUCKED = 0.12;
const FADE_MS = 1200;

/** 영상 소리를 켜면 현장음을 줄이도록 알린다 */
export function announceVideoSound(on: boolean) {
  window.dispatchEvent(new CustomEvent('taleframe:video-sound', { detail: on }));
}

export function SoundscapeProvider({ plan, children }: { plan: (string | null)[]; children: ReactNode }) {
  const available = plan.some(Boolean);
  const [enabled, setEnabled] = useState(false);
  const [index, setIndex] = useState(0);
  const howls = useRef(new Map<string, Howl>());
  const current = useRef<string | null>(null);
  const ducked = useRef(false);

  // 화면 가운데 선을 지나는 섹션을 현재 섹션으로
  useEffect(() => {
    if (!available) return;
    const els = document.querySelectorAll<HTMLElement>('[data-section-index]');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setIndex(Number(e.target.getAttribute('data-section-index')));
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [available]);

  const target = enabled ? (plan[index] ?? null) : null;

  useEffect(() => {
    if (target === current.current) return;
    let cancelled = false;
    const prev = current.current ? howls.current.get(current.current) : undefined;
    current.current = target;
    if (prev) {
      prev.fade(prev.volume(), 0, FADE_MS);
      setTimeout(() => prev.pause(), FADE_MS);
    }
    if (!target) return;
    (async () => {
      const { Howl } = await import('howler');
      if (cancelled) return;
      let h = howls.current.get(target);
      if (!h) {
        h = new Howl({ src: [target], loop: true, volume: 0, html5: true, format: ['m4a', 'mp4', 'aac'] });
        howls.current.set(target, h);
      }
      if (!h.playing()) h.play();
      h.fade(0, ducked.current ? DUCKED : VOLUME, FADE_MS);
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    const onVideo = (e: Event) => {
      ducked.current = (e as CustomEvent<boolean>).detail;
      const h = current.current ? howls.current.get(current.current) : undefined;
      h?.fade(h.volume(), ducked.current ? DUCKED : VOLUME, 400);
    };
    window.addEventListener('taleframe:video-sound', onVideo);
    const all = howls.current;
    return () => {
      window.removeEventListener('taleframe:video-sound', onVideo);
      all.forEach((h) => h.unload());
    };
  }, []);

  const toggle = useCallback(() => setEnabled((v) => !v), []);
  return <SoundCtx.Provider value={{ available, enabled, toggle }}>{children}</SoundCtx.Provider>;
}

export function SoundToggle() {
  const { available, enabled, toggle } = useSoundscape();
  if (!available) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      className="t-fine flex h-[32px] items-center gap-1.5 rounded-pill px-3 text-on-dark/90 transition-colors hover:text-on-dark active:scale-95"
    >
      <SoundIcon on={enabled} />
      {enabled ? '현장음 끄기' : '현장음 켜기'}
    </button>
  );
}

export function SoundIcon({ on, size = 14 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5Z" fill="currentColor" stroke="none" />
      {on ? (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" strokeLinecap="round" />
          <path d="M18.5 5.5a9 9 0 0 1 0 13" strokeLinecap="round" />
        </>
      ) : (
        <path d="m16 9 6 6m0-6-6 6" strokeLinecap="round" />
      )}
    </svg>
  );
}
