'use client';

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useRef, ViewTransition } from 'react';
import { Img } from '@/components/Img';
import { useMedia } from '@/components/StoryContext';
import { VideoPlayer } from '@/components/VideoPlayer';
import type { TemplateProps } from './types';
import { arVar, FRAME, isWide } from './util';

export function HeroFullbleed({ section: s, first, slug }: TemplateProps<'hero-fullbleed'>) {
  const media = useMedia(s.media);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, reduce ? 1 : 1.12]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0]);
  const bottom = s.align === 'bottom';
  // 가로 사진이 아니면 PC 에서는 꽉 채우지 않는다 — 사진은 오른쪽에 원래 비율로, 제목은 왼쪽에
  const framed = !isWide(media);

  return (
    <div ref={ref} className="relative h-[100svh] min-h-[520px] overflow-hidden bg-void text-on-dark" style={arVar(media)}>
      <motion.div
        className={`absolute inset-0 ${framed ? `md:inset-auto md:top-1/2 md:right-[6vw] md:-translate-y-1/2 md:overflow-hidden md:rounded-[4px] ${FRAME}` : ''}`}
        style={{ scale }}
      >
        {media.kind === 'video' ? (
          <VideoPlayer media={media} className="h-full w-full" priority={first} />
        ) : (
          <Img media={media} sizes="100vw" className="h-full w-full" priority={first} />
        )}
      </motion.div>
      <div className={`pointer-events-none absolute inset-0 ${bottom ? 'scrim-bottom' : 'bg-black/30'} ${framed ? 'md:hidden' : ''}`} />
      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className={`pointer-events-none absolute inset-x-0 mx-auto max-w-[980px] px-6 text-center ${
          bottom ? 'bottom-[12svh]' : 'top-1/2 -translate-y-1/2'
        } ${framed ? 'md:top-1/2 md:bottom-auto md:right-auto md:left-[6vw] md:mx-0 md:w-[min(36vw,520px)] md:-translate-y-1/2 md:px-0 md:text-left' : ''}`}
      >
        {s.kicker && <p className="t-tagline mb-3 text-on-dark/85">{s.kicker}</p>}
        <TitleTransition slug={slug} on={first}>
          <h1 className="t-hero">{s.title}</h1>
        </TitleTransition>
        {s.subtitle && <p className="t-lead-airy mt-4 text-on-dark/90">{s.subtitle}</p>}
      </motion.div>
      <ScrollHint />
    </div>
  );
}

/** 목록 카드의 제목이 스토리 첫 화면 제목으로 이어지는 전환 (첫 섹션에서만) */
export function TitleTransition({ slug, on, children }: { slug: string; on: boolean; children: React.ReactNode }) {
  return on ? <ViewTransition name={`title-${slug}`}>{children}</ViewTransition> : children;
}

export function ScrollHint() {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-on-dark/70"
      animate={reduce ? undefined : { y: [0, 6, 0] }}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.div>
  );
}

export function PostcardCover({ section: s, first, slug }: TemplateProps<'postcard-cover'>) {
  const media = useMedia(s.media);
  const reduce = useReducedMotion();
  const ratio = media.width / media.height;
  const portrait = ratio < 0.95;
  const width = portrait ? 'min(380px, 78vw)' : ratio < 1.15 ? 'min(520px, 82vw)' : 'min(640px, 86vw)';
  return (
    <div className="section-pad flex min-h-[100svh] flex-col items-center justify-center gap-10 overflow-x-clip">
      <motion.div
        initial={reduce ? false : { opacity: 0, rotate: -8, y: 40 }}
        animate={{ opacity: 1, rotate: -2.5, y: 0 }}
        transition={{ duration: 1, ease: [0.2, 0, 0, 1] }}
        className="relative rounded-sm bg-canvas p-3 pb-12 shadow-product"
        style={{ width }}
      >
        <Img
          media={media}
          sizes={portrait ? '380px' : '(max-width: 740px) 86vw, 640px'}
          className="w-full"
          style={{ aspectRatio: `${media.width} / ${media.height}` }}
          priority={first}
        />
        {s.stamp && (
          <div className="absolute -top-5 -right-5 grid h-24 w-24 rotate-12 place-items-center rounded-full border-2 border-dashed border-primary/70 bg-canvas/90 p-2 text-center">
            <span className="t-caption-strong text-primary">{s.stamp}</span>
          </div>
        )}
      </motion.div>
      <div className="max-w-[680px] text-center">
        <TitleTransition slug={slug} on={first}>
          <h1 className="t-hero">{s.title}</h1>
        </TitleTransition>
        {s.subtitle && <p className="t-lead-airy text-muted mt-3">{s.subtitle}</p>}
      </div>
    </div>
  );
}
