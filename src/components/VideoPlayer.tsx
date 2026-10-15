'use client';

import { useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ClientMedia } from '@/lib/resolve';
import { announceVideoSound, SoundIcon } from './Soundscape';

/**
 * 화면에 들어오면 무음으로 재생하고 벗어나면 멈춘다. 소리는 버튼으로 켠다.
 * 모션 줄이기 설정이면 자동 재생하지 않고 재생 버튼을 보여준다.
 */
export function VideoPlayer({
  media,
  className = '',
  style,
  fit = 'cover',
  priority,
}: {
  media: ClientMedia;
  className?: string;
  style?: CSSProperties;
  fit?: 'cover' | 'contain';
  priority?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const src = media.video?.src;

  useEffect(() => {
    const v = ref.current;
    if (!v || reduce) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduce]);

  useEffect(() => () => announceVideoSound(false), []);

  if (!src) return null;
  const toggleSound = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
    announceVideoSound(muted);
    if (v.paused) v.play().catch(() => {});
  };

  return (
    <div className={`relative overflow-hidden bg-void ${className}`} style={style}>
      <video
        ref={ref}
        src={src}
        poster={media.img.src}
        muted
        loop
        playsInline
        preload={priority ? 'auto' : 'metadata'}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        aria-label={media.img.alt || '여행 영상'}
        className="h-full w-full"
        style={{ objectFit: fit, objectPosition: media.img.position }}
      />
      <div className="absolute right-4 bottom-4 flex gap-2">
        {reduce && (
          <button
            type="button"
            className="btn-chip"
            onClick={() => (playing ? ref.current?.pause() : ref.current?.play())}
            aria-label={playing ? '일시정지' : '재생'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
        )}
        {media.video?.hasAudio && (
          <button type="button" className="btn-chip" onClick={toggleSound} aria-label={muted ? '소리 켜기' : '소리 끄기'} aria-pressed={!muted}>
            <SoundIcon on={!muted} size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
