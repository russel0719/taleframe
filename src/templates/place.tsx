'use client';

import { useInView, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useStory } from '@/components/StoryContext';
import { fitStyle, largestOf } from './util';
import { ScrollHint, TitleTransition } from './hero';
import type { TemplateProps } from './types';

const GlobeCanvas = dynamic(() => import('./map/GlobeCanvas'), { ssr: false });
const JourneyCanvas = dynamic(() => import('./map/JourneyCanvas'), { ssr: false });
const PanoramaViewer = dynamic(() => import('./PanoramaViewer'), { ssr: false });

/** 화면 근처에 왔을 때만 무거운 위젯을 받는다 */
function useNear<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const near = useInView(ref, { once: true, margin: '400px 0px' });
  return [ref, near] as const;
}

export function GlobeIntro({ section: s, first, slug }: TemplateProps<'globe-intro'>) {
  const [ref, near] = useNear<HTMLDivElement>();
  // 한 번 내려가면 다시 돌지 않는다
  const landed = useInView(ref, { amount: 0.6, once: true });
  const reduce = useReducedMotion() ?? false;
  return (
    <div ref={ref} className="relative h-[100svh] min-h-[520px] overflow-hidden bg-void text-on-dark">
      {near && <GlobeCanvas target={s.target} land={landed} reduce={reduce} />}
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
      <div className="pointer-events-none absolute inset-x-0 top-[22svh] mx-auto max-w-[980px] px-6 text-center">
        {s.kicker && <p className="t-tagline mb-3 text-on-dark/85">{s.kicker}</p>}
        <TitleTransition slug={slug} on={first}>
          <h1 className="t-hero">{s.title}</h1>
        </TitleTransition>
        {s.subtitle && <p className="t-lead-airy mt-4 text-on-dark/90">{s.subtitle}</p>}
      </div>
      <ScrollHint />
    </div>
  );
}

const TRANSPORT: Record<string, string> = {
  walk: '걸어서',
  train: '기차로',
  subway: '지하철로',
  bus: '버스로',
  car: '차로',
  taxi: '택시로',
  plane: '비행기로',
  ferry: '배로',
  bike: '자전거로',
};

export function MapJourney({ section: s, route }: TemplateProps<'map-journey'>) {
  const { media } = useStory();
  const [ref, near] = useNear<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion() ?? false;
  const steps = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step));
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    steps.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="relative">
      {s.heading && (
        <Reveal className="section-pad !pb-10 text-center">
          <h2 className="t-display-md">{s.heading}</h2>
        </Reveal>
      )}
      <div className="md:grid md:grid-cols-[1.35fr_1fr]">
        <div className="sticky top-[44px] z-10 h-[46svh] overflow-hidden bg-parchment md:top-0 md:h-[100svh]">
          {near && <JourneyCanvas stops={s.stops} route={route} active={active} reduce={reduce} />}
        </div>
        <ol className="relative px-4 pb-[30svh] md:px-10 md:pt-[30svh]">
          {s.stops.map((st, i) => {
            const m = st.media ? media[st.media] : undefined;
            return (
              <li
                key={i}
                data-step={i}
                ref={(el) => {
                  steps.current[i] = el;
                }}
                className={`my-[18svh] rounded-lg p-6 transition-opacity duration-500 md:my-[30svh] ${
                  i === active ? 'opacity-100' : 'opacity-45'
                }`}
                style={{ background: 'var(--tone-card)' }}
              >
                <p className="t-caption text-muted">
                  {i + 1} / {s.stops.length}
                  {i > 0 && st.transport ? ` · ${TRANSPORT[st.transport]}` : ''}
                </p>
                <h3 className="t-tagline mt-1">{st.name}</h3>
                {m && (
                  <Img media={m} sizes="(max-width: 834px) 90vw, 420px" className="mt-4 w-full rounded-sm" style={fitStyle(m, 40)} zoom={{ slides: [{ media: m, caption: st.name }], index: 0 }} />
                )}
                {st.note && <p className="t-body mt-3">{st.note}</p>}
                {i > 0 && route?.legs[i - 1] && route.legs[i - 1].mode !== 'straight' && (
                  <p className="t-fine text-muted mt-3 tabular-nums">약 {(route.legs[i - 1].meters / 1000).toFixed(1)}km</p>
                )}
              </li>
            );
          })}
          {route && (
            <li className="t-fine text-muted list-none">
              경로는 사진을 찍은 지점을 이어 OpenStreetMap 길 위로 계산한 것이다. 실제로 걸은 궤적과 조금 다를 수 있다.
            </li>
          )}
        </ol>
      </div>
    </div>
  );
}

export function SplitFeature({ section: s }: TemplateProps<'split-feature'>) {
  const { media } = useStory();
  const m = media[s.media];
  const right = s.side === 'right';
  return (
    <div className="section-pad">
      <div className={`mx-auto grid max-w-[1068px] items-center gap-10 md:grid-cols-2 md:gap-16 ${right ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <Reveal>
          <Img media={m} sizes="(max-width: 768px) 92vw, 520px" className="aspect-[4/5] w-full rounded-sm" zoom={{ slides: [{ media: m, caption: s.heading }], index: 0 }} />
        </Reveal>
        <Reveal delay={0.1}>
          {s.place && <p className="t-caption-strong text-muted mb-3">{s.place}</p>}
          <h2 className="t-display-md">{s.heading}</h2>
          <p className="t-body mt-5">{s.body}</p>
        </Reveal>
      </div>
    </div>
  );
}

export function PlaceFeature({ section: s }: TemplateProps<'place-feature'>) {
  const { media } = useStory();
  const m = media[s.media];
  const gallery = (s.gallery ?? []).map((id) => media[id]);
  const slides = [m, ...gallery].map((x) => ({ media: x, caption: s.name }));
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-[1068px]">
        <Reveal>
          <Img media={m} sizes="(max-width: 1100px) 94vw, 1068px" className="w-full rounded-sm" style={fitStyle(m, 78)} zoom={{ slides, index: 0 }} />
        </Reveal>
        <div className="mt-10 grid gap-10 md:grid-cols-[1.4fr_1fr]">
          <Reveal>
            <h2 className="t-display-md">{s.name}</h2>
            <p className="t-body mt-4">{s.description}</p>
          </Reveal>
          <Reveal delay={0.1}>
            {s.facts && (
              <dl className="space-y-4 border-t pt-4" style={{ borderColor: 'var(--tone-line)' }}>
                {s.facts.map((f, i) => (
                  <div key={i} className="flex justify-between gap-6">
                    <dt className="t-caption text-muted">{f.label}</dt>
                    <dd className="t-caption-strong text-right">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {gallery.length > 0 && (
              <div className="mt-6 grid grid-cols-4 gap-2">
                {gallery.map((g, i) => (
                  <Img key={g.id} media={g} sizes="120px" className="aspect-square w-full rounded-sm" zoom={{ slides, index: i + 1 }} />
                ))}
              </div>
            )}
          </Reveal>
        </div>
      </div>
    </div>
  );
}

export function Panorama({ section: s }: TemplateProps<'panorama'>) {
  const { media } = useStory();
  const m = media[s.media];
  const [ref, near] = useNear<HTMLDivElement>();
  return (
    <figure className="pb-section">
      <div ref={ref} className="relative h-[75svh] overflow-hidden bg-void">
        {near ? <PanoramaViewer src={largestOf(m)} caption={s.caption} /> : <Img media={m} sizes="100vw" className="h-full w-full" />}
        <p className="t-fine pointer-events-none absolute top-4 left-4 rounded-pill bg-black/55 px-3 py-1 text-on-dark">드래그해서 둘러보기 · 360°</p>
      </div>
      {(s.caption || s.place) && (
        <figcaption className="mx-auto mt-6 max-w-[680px] px-6 text-center">
          {s.caption && <p className="t-body">{s.caption}</p>}
          {s.place && <p className="t-caption text-muted mt-1">{s.place}</p>}
        </figcaption>
      )}
    </figure>
  );
}
