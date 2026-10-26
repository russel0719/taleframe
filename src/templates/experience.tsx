'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useStory } from '@/components/StoryContext';
import type { TemplateProps } from './types';
import { arVar, isWide } from './util';

export function FoodReview({ section: s }: TemplateProps<'food-review'>) {
  const { media } = useStory();
  const slides = s.items.map((it) => ({
    media: media[it.media],
    caption: [it.dish, it.restaurant].filter(Boolean).join(' · '),
  }));
  const cols = {
    1: 'max-w-[480px]',
    2: 'max-w-[860px] md:grid-cols-2',
    3: 'max-w-[1068px] md:grid-cols-2 lg:grid-cols-3',
    4: 'max-w-[1068px] md:grid-cols-2 lg:grid-cols-4',
  }[s.items.length];
  return (
    <div className="section-pad">
      {s.heading && (
        <Reveal>
          <h2 className="t-display-md mb-10 text-center">{s.heading}</h2>
        </Reveal>
      )}
      <div className={`mx-auto grid gap-5 ${cols}`}>
        {s.items.map((it, i) => (
          <Reveal key={i} delay={i * 0.08}>
            <article className="h-full rounded-lg border p-5" style={{ background: 'var(--tone-card)', borderColor: 'var(--tone-line)' }}>
              <Img media={media[it.media]} sizes="(max-width: 768px) 90vw, 360px" className="aspect-square w-full rounded-sm" zoom={{ slides, index: i }} />
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <h3 className="t-body-strong">{it.dish}</h3>
                {it.price && <span className="t-caption text-muted shrink-0">{it.price}</span>}
              </div>
              {it.restaurant && <p className="t-caption text-muted mt-1">{it.restaurant}</p>}
              {it.note && <p className="t-body mt-3">{it.note}</p>}
            </article>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export function Recommendation({ section: s }: TemplateProps<'recommendation'>) {
  const groups = [
    { title: '좋았던 점', items: s.pros, mark: '+' },
    { title: '아쉬운 점', items: s.cons, mark: '−' },
    { title: '다음 여행자에게', items: s.tips, mark: '→' },
  ].filter((g) => g.items?.length);
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-[1068px]">
        {s.heading && (
          <Reveal>
            <h2 className="t-display-md mb-10 text-center">{s.heading}</h2>
          </Reveal>
        )}
        <div className={`grid gap-10 ${{ 1: 'mx-auto max-w-[680px]', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' }[groups.length]}`}>
          {groups.map((g, gi) => (
            <Reveal key={g.title} delay={gi * 0.08}>
              <h3 className="t-tagline mb-4">{g.title}</h3>
              <ul className="space-y-3">
                {g.items!.map((t, i) => (
                  <li key={i} className="t-body flex gap-3">
                    <span aria-hidden className="text-muted w-4 shrink-0 text-center">{g.mark}</span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DailyTimeline({ section: s }: TemplateProps<'daily-timeline'>) {
  const { media } = useStory();
  const withMedia = s.entries.filter((e) => e.media);
  const slides = withMedia.map((e) => ({ media: media[e.media!], caption: [e.time, e.title].filter(Boolean).join(' · ') }));
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-[760px]">
        {(s.day || s.date) && (
          <Reveal className="mb-12 text-center">
            {s.day && <h2 className="t-display-md">{s.day}</h2>}
            {s.date && <p className="t-caption text-muted mt-1">{s.date.replaceAll('-', '. ')}</p>}
          </Reveal>
        )}
        <ol className="relative border-l pl-8" style={{ borderColor: 'var(--tone-line)' }}>
          {s.entries.map((e, i) => {
            const m = e.media ? media[e.media] : undefined;
            const si = m ? withMedia.indexOf(e) : -1;
            return (
              <Reveal as="li" key={i} delay={0.04 * i} className="relative mb-12 last:mb-0">
                <span aria-hidden className="absolute top-1.5 -left-[38px] h-3 w-3 rounded-full border-2 bg-primary" style={{ borderColor: 'var(--tone-card)' }} />
                <div className="flex gap-5">
                  <div className="flex-1">
                    {e.time && <p className="t-caption-strong text-muted tabular-nums">{e.time}</p>}
                    <h3 className="t-tagline mt-1">{e.title}</h3>
                    {e.note && <p className="t-body mt-2">{e.note}</p>}
                  </div>
                  {m && <Img media={m} sizes="140px" className="aspect-square w-[min(140px,28vw)] shrink-0 rounded-sm" zoom={{ slides, index: si }} />}
                </div>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const decimals = Number.isInteger(value) ? 0 : 1;
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(0, value, { duration: 1.6, ease: [0.2, 0, 0, 1], onUpdate: setShown });
    return () => c.stop();
  }, [inView, reduce, value]);
  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString('ko-KR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

export function TravelStats({ section: s }: TemplateProps<'travel-stats'>) {
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-[1068px]">
        {s.heading && (
          <Reveal>
            <h2 className="t-display-md mb-12 text-center">{s.heading}</h2>
          </Reveal>
        )}
        <dl className="grid grid-cols-2 gap-y-12 text-center md:grid-cols-3">
          {s.stats.map((st, i) => (
            <div key={i}>
              <dd className="t-hero">
                <CountUp value={st.value} />
                {st.unit && <span className="t-tagline ml-1">{st.unit}</span>}
              </dd>
              <dt className="t-caption text-muted mt-2">{st.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function Closing({ section: s }: TemplateProps<'closing'>) {
  const { media } = useStory();
  const m = s.media ? media[s.media] : undefined;
  const text = (
    <Reveal className="relative mx-auto max-w-[860px] px-6 text-center">
      <p className="t-display-md">{s.line}</p>
      {s.credit && <p className="t-caption mt-6 opacity-75">{s.credit}</p>}
    </Reveal>
  );
  if (!m) return <div className="section-pad py-[140px]">{text}</div>;
  const framed = !isWide(m);
  return (
    <div
      className={`relative grid min-h-[100svh] place-items-center overflow-hidden text-on-dark ${framed ? 'md:flex md:flex-col md:justify-center md:gap-12 md:bg-void md:py-[8svh]' : ''}`}
      style={arVar(m)}
    >
      <Img
        media={m}
        sizes={framed ? '(max-width: 768px) 100vw, 64svh' : '100vw'}
        className={`absolute inset-0 h-full w-full ${framed ? 'md:relative md:inset-auto md:aspect-[var(--ar)] md:h-[min(64svh,calc(80vw/var(--ar)))] md:w-auto md:rounded-[4px]' : ''}`}
      />
      <div className={`absolute inset-0 bg-black/45 ${framed ? 'md:hidden' : ''}`} />
      {text}
    </div>
  );
}
