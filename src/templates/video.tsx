'use client';

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useStory } from '@/components/StoryContext';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { TemplateProps } from './types';

export function VideoCinematic({ section: s, first }: TemplateProps<'video-cinematic'>) {
  const { media } = useStory();
  const m = media[s.media];
  const portrait = m.height > m.width;
  return (
    <figure className={portrait ? 'section-pad' : 'pb-section'}>
      <Reveal className={portrait ? 'mx-auto max-w-[480px]' : ''}>
        <VideoPlayer
          media={m}
          priority={first}
          className={portrait ? 'w-full rounded-sm' : 'w-full max-h-[100svh]'}
          style={{ aspectRatio: `${m.width} / ${m.height}` }}
          fit="cover"
        />
      </Reveal>
      {(s.caption || s.place) && (
        <figcaption className="mx-auto mt-6 max-w-[680px] px-6 text-center">
          {s.caption && <p className="t-body">{s.caption}</p>}
          {s.place && <p className="t-caption text-muted mt-1">{s.place}</p>}
        </figcaption>
      )}
    </figure>
  );
}

function StepText({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: React.ReactNode }) {
  const [a, b] = range;
  const mid = (a + b) / 2;
  const opacity = useTransform(progress, [a, a + (mid - a) * 0.5, b - (b - mid) * 0.5, b], [0, 1, 1, 0]);
  const y = useTransform(progress, [a, b], [40, -40]);
  return (
    <motion.p style={{ opacity, y }} className="t-display-md absolute inset-x-0 top-1/2 mx-auto max-w-[860px] -translate-y-1/2 px-6 text-center">
      {children}
    </motion.p>
  );
}

/**
 * 스크롤 = 영상의 재생 위치. 모든 프레임이 키프레임인 `-scrub.mp4` 를 써서 어느 지점이든 바로 찾아간다.
 * 모션 줄이기 설정이면 포스터와 문장만 차례로 보여준다.
 */
export function ScrollScrub({ section: s }: TemplateProps<'scroll-scrub'>) {
  const { media } = useStory();
  const m = media[s.media];
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const frame = useRef(0);

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const v = video.current;
    if (!v || !ready || !v.duration) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      v.currentTime = Math.min(v.duration - 0.05, Math.max(0, p * v.duration));
    });
  });

  // iOS Safari 는 한 번 재생 시도를 해야 프레임을 그린다
  useEffect(() => {
    const v = video.current;
    if (!v || reduce) return;
    const prime = () => {
      v.play().then(() => v.pause()).catch(() => {});
      setReady(true);
    };
    if (v.readyState >= 2) prime();
    else v.addEventListener('loadeddata', prime, { once: true });
  }, [reduce]);

  if (reduce || !m.video?.scrub) {
    return (
      <div className="relative">
        <Img media={m} sizes="100vw" className="h-[80svh] w-full" />
        <div className="section-pad mx-auto max-w-[860px] space-y-6 text-center">
          {s.steps.map((st, i) => (
            <p key={i} className="t-lead-airy">{st.text}</p>
          ))}
        </div>
      </div>
    );
  }

  const n = s.steps.length;
  return (
    <div ref={ref} style={{ height: `${(n + 1) * 100}svh` }} className="relative">
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-void text-on-dark">
        <video
          ref={video}
          src={m.video.scrub}
          poster={m.img.src}
          muted
          playsInline
          preload="auto"
          aria-label={m.img.alt || '스크롤로 재생되는 영상'}
          className="h-full w-full object-cover"
          style={{ objectPosition: m.img.position }}
        />
        <div className="absolute inset-0 bg-black/45" />
        {s.steps.map((st, i) => (
          <StepText key={i} progress={scrollYProgress} range={[(i + 0.15) / (n + 0.3), (i + 1.15) / (n + 0.3)]}>
            {st.text}
          </StepText>
        ))}
      </div>
    </div>
  );
}

function StickyLayer({ progress, i, n, children }: { progress: MotionValue<number>; i: number; n: number; children: React.ReactNode }) {
  // 컨테이너 높이 (n + 0.5) 화면, 글 카드 i 가 화면 가운데에 오는 진행도 = i / (n - 0.5).
  // 앞 카드가 반쯤 올라갔을 때 사진을 바꾸기 시작해, 카드가 가운데 오기 전에 다 바꾼다 — 두 사진이 겹쳐 보이지 않게
  const u = 1 / (n - 0.5);
  const opacity = useTransform(progress, i === 0 ? [0, 1] : [(i - 0.5) * u, (i - 0.15) * u], i === 0 ? [1, 1] : [0, 1]);
  // 단계마다 아주 천천히 다가간다 (켄 번스)
  const scale = useTransform(progress, [Math.max(0, (i - 0.5) * u), (i + 0.5) * u], [1, 1.08]);
  return (
    <motion.div className="absolute inset-0" style={{ opacity, scale }}>
      {children}
    </motion.div>
  );
}

export function StickyStory({ section: s }: TemplateProps<'sticky-story'>) {
  const { media } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const n = s.steps.length;

  if (reduce) {
    return (
      <div className="section-pad mx-auto max-w-[980px] space-y-16">
        {s.steps.map((st, i) => (
          <div key={i}>
            <Img media={media[st.media]} sizes="(max-width: 1000px) 94vw, 980px" className="aspect-[3/2] w-full rounded-sm" />
            {st.heading && <h3 className="t-tagline mt-6">{st.heading}</h3>}
            <p className="t-body mt-2">{st.text}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative" style={{ height: `${n * 100 + 50}svh` }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden bg-void">
        {s.steps.map((st, i) => (
          <StickyLayer key={i} progress={scrollYProgress} i={i} n={n}>
            <Img media={media[st.media]} sizes="100vw" className="h-full w-full" />
          </StickyLayer>
        ))}
        <div className="absolute inset-0 bg-black/25" />
      </div>
      {/* 글 카드는 스크롤에 따라 사진 위를 지나간다 */}
      <div className="relative -mt-[100svh]">
        {s.steps.map((st, i) => (
          <div key={i} className="flex h-[100svh] items-end px-4 pb-[12svh] md:items-center md:justify-end md:px-[6vw] md:pb-0">
            <Reveal className="w-full max-w-[420px] rounded-lg bg-canvas/90 p-6 text-ink backdrop-blur-xl backdrop-saturate-[1.8]">
              {st.heading && <h3 className="t-tagline mb-2">{st.heading}</h3>}
              <p className="t-body">{st.text}</p>
            </Reveal>
          </div>
        ))}
      </div>
    </div>
  );
}
