'use client';

/**
 * 종이 위의 것들 — 엽서 뒷면 · 영수증 · 걸은 선 · 출발 안내판 · 사진 더미 · 실물 스크랩.
 * keepsake.tsx 와 같은 규칙: 사실은 섹션에 적힌 것과 촬영 시각만, 스크롤 값은 함수형 useTransform 만,
 * SSR 하는 값의 소수는 반올림한다 (서버·브라우저 끝자리 차이로 하이드레이션이 어긋난다).
 */
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue, type PanInfo } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useMedia, useStory } from '@/components/StoryContext';
import type { ClientMedia } from '@/lib/resolve';
import type { RouteData, SectionOf } from '@/lib/story/schema';
import type { TemplateProps } from './types';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const jitter = (i: number, seed = 1) => {
  const x = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const thumbSrc = (m: ClientMedia) => m.img.fallback ?? m.full.srcSet[0].src;

/** 종이 결 — 바탕에 곱하면 회색으로 탁해져서(실험실에서 확인) 옅은 층으로 얹는다 */
function PaperGrain({ opacity = 0.07 }: { opacity?: number }) {
  return <span aria-hidden className="pointer-events-none absolute inset-0 mix-blend-multiply" style={{ backgroundImage: GRAIN, opacity }} />;
}

// ── Postcard Back — 엽서 뒷면 ─────────────────────────────────

/**
 * 우표 톱니 — 안쪽(content-box)은 통째로 보이고, 테두리(padding)에만 구멍 무늬를 둔다.
 * 구멍 무늬를 전체에 깔면 사진 한가운데까지 구멍이 뚫린다 (실험실에서 확인)
 */
const STAMP_MASK = {
  image: 'linear-gradient(#000 0 0), radial-gradient(circle, transparent 2.3px, #000 2.7px)',
  clip: 'content-box, border-box',
  origin: 'content-box, border-box',
  size: '100% 100%, 8px 8px',
  position: '0 0, -4px -4px',
  repeat: 'no-repeat, repeat',
};
const STAMP_EDGE = {
  maskImage: STAMP_MASK.image,
  maskClip: STAMP_MASK.clip,
  maskOrigin: STAMP_MASK.origin,
  maskSize: STAMP_MASK.size,
  maskPosition: STAMP_MASK.position,
  maskRepeat: STAMP_MASK.repeat,
  WebkitMaskImage: STAMP_MASK.image,
  WebkitMaskClip: STAMP_MASK.clip,
  WebkitMaskOrigin: STAMP_MASK.origin,
  WebkitMaskSize: STAMP_MASK.size,
  WebkitMaskPosition: STAMP_MASK.position,
  WebkitMaskRepeat: STAMP_MASK.repeat,
} as const;

function Postmark({ place, date }: { place?: string; date?: string }) {
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
      <defs>
        <path id="pm-top" d="M 20 60 A 40 40 0 0 1 100 60" />
        <path id="pm-bottom" d="M 22 62 A 38 38 0 0 0 98 62" />
      </defs>
      <g fill="none" stroke="#2f3a5a" strokeOpacity=".72">
        <circle cx="60" cy="60" r="46" strokeWidth="2.4" />
        <circle cx="60" cy="60" r="31" strokeWidth="1.2" />
      </g>
      <g fill="#2f3a5a" fillOpacity=".78" fontFamily="ui-monospace, monospace" fontWeight="700" letterSpacing="2">
        <text fontSize="10" textAnchor="middle">
          <textPath href="#pm-top" startOffset="50%">
            {place ?? 'TALEFRAME'}
          </textPath>
        </text>
        <text x="60" y="64" fontSize="11" textAnchor="middle" letterSpacing="0">
          {date ?? ''}
        </text>
      </g>
      {/* 소인 옆 물결 줄 */}
      <g fill="none" stroke="#2f3a5a" strokeOpacity=".55" strokeWidth="1.6">
        {[0, 1, 2, 3].map((k) => (
          <path key={k} d={`M 108 ${42 + k * 10} q 6 -4 12 0 t 12 0 t 12 0`} />
        ))}
      </g>
    </svg>
  );
}

export function PostcardBack({ section: s }: TemplateProps<'postcard-back'>) {
  const m = useMedia(s.media);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const extra = useMotionValue(0);
  const flip = useTransform(() => clamp01((scrollYProgress.get() - 0.3) / 0.3) * 180 + extra.get());
  const date = (s.date ?? m.taken?.slice(0, 10))?.replaceAll('-', '.');
  const [hint, setHint] = useState(true);

  const front = (
    <div className="absolute inset-0 bg-[#fdfbf6] p-[3.5%] shadow-product [backface-visibility:hidden]">
      <Img media={m} sizes="(max-width: 768px) 86vw, 700px" className="h-full w-full" />
    </div>
  );
  const back = (
    <div
      className="absolute inset-0 flex flex-col gap-4 bg-[#fdfbf6] p-[clamp(16px,4%,32px)] text-[#2b2b2b] shadow-product [backface-visibility:hidden] md:flex-row md:gap-6"
      style={{ transform: 'rotateY(180deg)' }}
    >
      <PaperGrain />
      <div className="relative order-2 min-h-0 flex-1 md:order-1">
        {/* 옅은 줄 — 글씨가 줄 위에 앉는다 */}
        <p
          className="font-hand text-[clamp(28px,4vw,40px)] leading-[1.5em] break-keep"
          style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 calc(1.5em - 1px), rgba(120,110,90,.22) calc(1.5em - 1px) 1.5em)' }}
        >
          {s.message}
        </p>
      </div>
      <div className="order-1 flex shrink-0 flex-col md:order-2 md:w-[38%] md:border-l md:border-[#cfc6b4] md:pl-6">
        <div className="relative ml-auto h-[clamp(64px,13vw,96px)] w-[clamp(52px,10.5vw,78px)]">
          {/* 우표 — 톱니 가장자리 */}
          <div
            className="absolute inset-0 bg-white p-[5px]"
            style={STAMP_EDGE}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 우표 속 작은 사진 */}
            <img src={thumbSrc(m)} alt="" className="h-full w-full object-cover" style={{ objectPosition: m.img.position }} />
          </div>
          <div className="absolute -bottom-8 -left-20 h-[clamp(88px,17vw,128px)] w-[clamp(88px,17vw,128px)] -rotate-12">
            <Postmark place={s.place?.toUpperCase()} date={date} />
          </div>
        </div>
        <div className="mt-auto hidden space-y-4 pt-8 md:block">
          {s.to && <p className="border-b border-[#cfc6b4] pb-1 font-hand text-[30px]">To. {s.to}</p>}
          <p className="border-b border-[#cfc6b4] pb-1 font-hand text-[30px] text-[#6b6355]">{s.from ? `From. ${s.from}` : ' '}</p>
        </div>
      </div>
      {(s.to || s.from) && (
        <p className="relative order-3 font-hand text-[26px] text-[#6b6355] md:hidden">
          {s.to && `To. ${s.to}`} {s.from && ` · From. ${s.from}`}
        </p>
      )}
    </div>
  );
  const card = 'relative mx-auto aspect-[3/4] w-[min(86vw,420px)] md:aspect-[3/2] md:w-[min(80vw,720px)]';

  if (reduce) {
    return (
      <div className="section-pad grid gap-10 md:grid-cols-2 md:items-center">
        <div className={card}>{front}</div>
        <div className={card}>
          <div className="absolute inset-0" style={{ transform: 'rotateY(180deg)' }}>
            {back}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative" style={{ height: '200svh' }}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center gap-6 overflow-hidden px-4" style={{ perspective: 1800 }}>
        <motion.button
          type="button"
          aria-label="엽서 뒤집기"
          onClick={() => {
            animate(extra, extra.get() + 180, { type: 'spring', stiffness: 90, damping: 16 });
            setHint(false);
          }}
          className={`${card} cursor-pointer [transform-style:preserve-3d]`}
          style={{ rotateY: flip, rotateZ: -1.5 }}
        >
          {front}
          {back}
        </motion.button>
        <p className="t-fine text-muted transition-opacity duration-500" style={{ opacity: hint ? 1 : 0 }}>
          내려가거나 누르면 엽서가 뒤집혀요
        </p>
      </div>
    </div>
  );
}

// ── Receipt — 영수증 ──────────────────────────────────────────

const PAPER = '#fbfbf8';
/** 아래 가장자리 톱니 — 찢은 감열지. 아래로 향한 삼각형 SVG 를 가로로 잇는다 (CSS 마스크로는 렌더되지 않았다) */
const ZIGZAG = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='7'%3E%3Cpath d='M0 0H14L7 7Z' fill='%23${PAPER.slice(1)}'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'repeat-x',
  backgroundSize: '14px 7px',
} as const;

export function Receipt({ section: s }: TemplateProps<'receipt'>) {
  const { media, openLightbox } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // 섹션 아래 끝이 화면에 들어올 때 다 나와 있어야 한다 — 끝까지 안 나오면 아래 톱니가 잘린다 (실험실에서 확인)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 1'] });
  // 프린터에서 종이가 내려온다 — 위에서부터 드러난다
  const shown = (p: number) => (reduce ? 1 : clamp01(p / 0.9));
  const clip = useTransform(scrollYProgress, (p) => (shown(p) >= 1 ? 'none' : `inset(0 0 ${r2((1 - shown(p)) * 100)}% 0)`));
  const y = useTransform(scrollYProgress, (p) => r2((1 - shown(p)) * -40));
  const lines = s.lines.map((l) => {
    const m = l.media ? media[l.media] : undefined;
    return { ...l, m, time: l.time ?? m?.taken?.slice(11) };
  });
  const shots = lines.filter((l) => l.m);
  const slides = shots.map((l) => ({ media: l.m!, caption: l.item }));
  const date = s.date?.replaceAll('-', '.') ?? lines.find((l) => l.m?.taken)?.m?.taken?.slice(0, 10).replaceAll('-', '.');

  return (
    <div ref={ref} className="section-pad">
      {s.heading && (
        <Reveal className="mx-auto mb-10 max-w-[560px] text-center">
          <h2 className="t-display-md">{s.heading}</h2>
        </Reveal>
      )}
      <div className="relative mx-auto w-[min(88vw,360px)]">
        {/* 프린터 입구 */}
        <div aria-hidden className="relative z-10 mx-[-14px] h-4 rounded-full bg-[#4a4a4f] shadow-[0_4px_10px_rgba(0,0,0,.45),inset_0_-3px_0_rgba(0,0,0,.45)]" />
        <motion.div style={{ clipPath: clip, y }} className="relative -mt-2 drop-shadow-[0_8px_18px_rgba(0,0,0,.14)]">
          <div className="relative px-6 pt-8 pb-8 font-mono text-[13px] leading-[1.7] text-[#2a2a2a]" style={{ background: PAPER }}>
            <PaperGrain opacity={0.05} />
            <p className="text-center text-[15px] font-bold tracking-[0.08em]">{s.title}</p>
            {date && <p className="text-center text-[12px] text-[#777]">{date}</p>}
            <p className="my-3 overflow-hidden whitespace-nowrap text-[#999]">{'-'.repeat(60)}</p>
            <ol className="space-y-1.5">
              {lines.map((l, i) => {
                const k = shots.indexOf(l);
                return (
                  <li key={i} className="flex items-baseline gap-3">
                    <span className="w-[42px] shrink-0 text-[#888] tabular-nums">{l.time ?? ''}</span>
                    {l.m ? (
                      <button type="button" onClick={() => openLightbox(slides, k)} className="min-w-0 flex-1 truncate text-left underline decoration-[#bbb] decoration-dotted underline-offset-4">
                        {l.item}
                      </button>
                    ) : (
                      <span className="min-w-0 flex-1 truncate">{l.item}</span>
                    )}
                    <span className="shrink-0 tabular-nums">{l.price ?? '—'}</span>
                  </li>
                );
              })}
            </ol>
            <p className="my-3 overflow-hidden whitespace-nowrap text-[#999]">{'-'.repeat(60)}</p>
            {s.total && (
              <p className="flex justify-between text-[15px] font-bold">
                <span>{s.total.label}</span>
                <span className="tabular-nums">{s.total.value}</span>
              </p>
            )}
            {s.footer && <p className="mt-6 text-center text-[12px] tracking-[0.1em] text-[#777]">{s.footer}</p>}
            <p className="mt-4 text-center text-[11px] tracking-[0.3em] text-[#aaa]">* * * TALEFRAME * * *</p>
          </div>
          <div aria-hidden className="h-[7px]" style={ZIGZAG} />
        </motion.div>
      </div>
    </div>
  );
}

// ── Walk Line — 걸은 선 ───────────────────────────────────────

type Stop = SectionOf<'walk-line'>['stops'][number];

/** 위경도 → 그림 좌표 (등장방형 + 위도 보정). 가로 1000 에 맞추고 세로는 모양대로 */
export function projectWalk(stops: Stop[], route?: RouteData) {
  const legs = stops.slice(1).map((b, i) => {
    const leg = route?.legs[i];
    const a = stops[i];
    const coords = leg ? leg.coords : [[a.lng, a.lat], [b.lng, b.lat]];
    const meters = leg?.meters ?? 0;
    return { coords, foot: leg ? leg.mode !== 'straight' : false, meters };
  });
  // 걸은 구간만으로 범위를 잡는다 — 기차·배로 간 먼 곳까지 넣으면 걸은 길이 구석에 작게 몰린다 (실험실에서 확인)
  const footPts = legs.flatMap((l, i) => (l.foot ? [...l.coords, [stops[i].lng, stops[i].lat], [stops[i + 1].lng, stops[i + 1].lat]] : []));
  const all = footPts.length >= 2 ? footPts : [...legs.flatMap((l) => l.coords), ...stops.map((s) => [s.lng, s.lat])];
  const lat0 = all.reduce((a, c) => a + c[1], 0) / all.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = all.map((c) => c[0] * k);
  const ys = all.map((c) => -c[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 1000;
  const pad = 70;
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const HMAX = 1300;
  // 가로를 꽉 채우되, 세로로 긴 길이면 세로 상한에 맞춰 줄이고 가운데 둔다
  const scale = Math.min((W - pad * 2) / spanX, (HMAX - pad * 2) / spanY);
  const H = Math.min(HMAX, Math.max(560, spanY * scale + pad * 2));
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const pt = (c: number[]) => [r2(offX + (c[0] * k - minX) * scale), r2(offY + (-c[1] - minY) * scale)] as const;
  return {
    W,
    H,
    legs: legs.map((l) => ({ ...l, d: l.coords.map((c, j) => `${j ? 'L' : 'M'} ${pt(c).join(' ')}`).join(' ') })),
    // 그림 밖 장소는 가장자리에 붙여 "→ 이름" 으로만 남긴다
    stops: stops.map((s) => {
      const [x, y] = pt([s.lng, s.lat]);
      const off = x < 0 || x > W || y < 0 || y > H;
      return { name: s.name, off, at: [r2(Math.min(W - pad / 2, Math.max(pad / 2, x))), r2(Math.min(H - pad / 2, Math.max(pad / 2, y)))] as const };
    }),
  };
}

function Leg({ p, from, to, d, foot }: { p: MotionValue<number>; from: number; to: number; d: string; foot: boolean }) {
  const len = useTransform(p, (v) => clamp01((v - from) / Math.max(1e-6, to - from)));
  return (
    <motion.path
      d={d}
      fill="none"
      stroke="#1f2a44"
      strokeWidth={foot ? 4 : 2}
      strokeOpacity={foot ? 0.92 : 0.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ pathLength: len }}
    />
  );
}

function StopMark({ p, at, x, y, name, i, off }: { p: MotionValue<number>; at: number; x: number; y: number; name: string; i: number; off: boolean }) {
  const o = useTransform(p, (v) => (v >= at - 0.001 ? 1 : 0));
  const left = x > 700;
  if (off) {
    return (
      <motion.text style={{ opacity: o, fontFamily: 'var(--font-hand)' }} x={x} y={y} textAnchor={left ? 'end' : 'start'} fontSize={36} fill="#1f2a44" fillOpacity={0.7}>
        {left ? `${name} →` : `← ${name}`}
      </motion.text>
    );
  }
  return (
    <motion.g style={{ opacity: o }}>
      <circle cx={x} cy={y} r={9} fill="#f6f1e6" stroke="#1f2a44" strokeWidth={3} />
      <text x={left ? x - 18 : x + 18} y={y + (i % 2 ? 34 : -16)} textAnchor={left ? 'end' : 'start'} fontSize={40} fill="#1f2a44" style={{ fontFamily: 'var(--font-hand)' }}>
        {name}
      </text>
    </motion.g>
  );
}

export function WalkLine({ section: s, route }: TemplateProps<'walk-line'>) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const g = useMemo(() => projectWalk(s.stops, route), [s.stops, route]);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const P = useTransform(scrollYProgress, (v) => (reduce ? 1 : clamp01((v - 0.08) / 0.8)));
  // 구간 길이 비율로 진행을 나눈다 (경로가 없는 구간은 짧게)
  const weights = g.legs.map((l) => (l.foot ? Math.max(l.meters, 300) : 600));
  const total = weights.reduce((a, b) => a + b, 0);
  const cum = weights.reduce<number[]>((acc, w) => [...acc, (acc[acc.length - 1] ?? 0) + w / total], []);
  const walked = g.legs.reduce((a, l) => a + (l.foot ? l.meters : 0), 0);
  const km = useTransform(P, (v) => {
    let m = 0;
    g.legs.forEach((l, i) => {
      if (!l.foot) return;
      const from = i ? cum[i - 1] : 0;
      m += l.meters * clamp01((v - from) / (cum[i] - from));
    });
    return `${(m / 1000).toFixed(1)} km`;
  });

  return (
    <div ref={ref} className="relative" style={{ height: reduce ? 'auto' : '230svh', background: '#f6f1e6', color: '#1f2a44' }}>
      <div className={`${reduce ? '' : 'sticky top-0 h-[100svh]'} flex flex-col items-center justify-center gap-4 overflow-hidden px-4 py-10`}>
        {s.heading && <p className="font-serif text-[clamp(20px,2.6vw,30px)]">{s.heading}</p>}
        <svg viewBox={`0 0 ${g.W} ${g.H}`} className="max-h-[68svh] w-full max-w-[980px]" role="img" aria-label={`${s.stops.map((x) => x.name).join(' → ')} 걸은 길`}>
          {g.legs.map((l, i) => (
            <Leg key={i} p={P} from={i ? cum[i - 1] : 0} to={cum[i]} d={l.d} foot={l.foot} />
          ))}
          {g.stops.map((st, i) => (
            <StopMark key={i} p={P} at={i ? cum[i - 1] : 0} x={st.at[0]} y={st.at[1]} name={st.name} i={i} off={st.off} />
          ))}
        </svg>
        <div className="flex w-full max-w-[980px] items-baseline justify-between gap-4 border-t border-[#1f2a44]/25 pt-3">
          <motion.p className="font-mono text-[clamp(20px,3vw,30px)] tabular-nums">{reduce ? `${(walked / 1000).toFixed(1)} km` : km}</motion.p>
          {s.title && <p className="font-hand text-[clamp(28px,3.8vw,40px)]">{s.title}</p>}
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-multiply" style={{ backgroundImage: GRAIN, opacity: 0.12 }} />
    </div>
  );
}

// ── Split-Flap — 출발 안내판 ──────────────────────────────────

const FLAP_POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789가나다라마바사아자차카타파하→.:';

function Board({ rows, run }: { rows: { text: string; note?: string }[]; run: boolean }) {
  const [tick, setTick] = useState(0);
  const reduce = useReducedMotion();
  const cells = rows.map((r) => [...r.text]);
  const longest = Math.max(...cells.map((c) => c.length));
  const done = 14 + longest + rows.length * 4;
  useEffect(() => {
    if (!run || reduce) return;
    const id = setInterval(() => setTick((t) => (t >= done ? t : t + 1)), 75);
    return () => clearInterval(id);
  }, [run, reduce, done]);
  const t = reduce ? done : tick;
  return (
    <div className="space-y-2">
      {cells.map((chars, r) => (
        <div key={r} className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div className="flex gap-[3px]" aria-hidden>
            {chars.map((ch, i) => {
              const start = r * 4 + i;
              const steps = 8 + ((i * 3 + r) % 6);
              const k = t - start;
              const shown = k <= 0 ? ' ' : k >= steps || ch === ' ' ? ch : FLAP_POOL[(i * 7 + r * 5 + k * 3) % FLAP_POOL.length];
              return (
                <span key={i} className="relative grid h-[1.5em] w-[1.12em] place-items-center overflow-hidden rounded-[3px] bg-[#1b1b1d] text-[#f2efe6] shadow-[inset_0_-1px_0_rgba(255,255,255,.06)]" style={{ perspective: 200 }}>
                  <span key={shown} className="tf-flap block">
                    {shown}
                  </span>
                  <span className="absolute inset-x-0 top-1/2 h-px bg-black/70" />
                </span>
              );
            })}
          </div>
          {rows[r].note && <span className="font-mono text-[0.5em] tracking-[0.18em] text-[#f0b43c]">{rows[r].note}</span>}
        </div>
      ))}
      <p className="sr-only">{rows.map((r) => [r.text, r.note].filter(Boolean).join(' ')).join(', ')}</p>
    </div>
  );
}

export function SplitFlap({ section: s }: TemplateProps<'split-flap'>) {
  const m = useMedia(s.media);
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  return (
    <div ref={ref} className="relative grid min-h-[86svh] place-items-center overflow-hidden bg-void px-4 py-20 text-white">
      {m && (
        <div className="absolute inset-0 opacity-35">
          <Img media={m} sizes="100vw" className="h-full w-full" />
        </div>
      )}
      <div className="relative rounded-[10px] bg-[#0d0d0e]/90 p-[clamp(14px,3vw,28px)] shadow-[0_20px_60px_rgba(0,0,0,.5)]">
        {s.board && <p className="mb-4 font-mono text-[12px] tracking-[0.4em] text-[#f0b43c]">{s.board}</p>}
        <div className="font-mono text-[clamp(20px,4.6vw,46px)] leading-none font-bold">
          <Board rows={s.rows} run={seen} />
        </div>
      </div>
    </div>
  );
}

// ── Photo Stack — 사진 더미 ───────────────────────────────────

export function PhotoStack({ section: s }: TemplateProps<'photo-stack'>) {
  const { media, openLightbox } = useStory();
  const reduce = useReducedMotion();
  const items = s.items.map((it, i) => ({ ...it, m: media[it.media], rot: Math.round(jitter(i, 3) * 120) / 10 }));
  const slides = items.map((it) => ({ media: it.m, caption: it.caption }));
  const [order, setOrder] = useState(() => items.map((_, i) => i));
  const [fly, setFly] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const top = order[0];
  const next = (dir: 1 | -1 = 1) => {
    if (fly) return;
    if (reduce) setOrder((o) => [...o.slice(1), o[0]]);
    else setFly({ i: top, dir });
  };

  return (
    <div className="section-pad overflow-x-clip">
      {s.heading && (
        <Reveal className="mx-auto mb-8 max-w-[560px] text-center">
          <h2 className="t-display-md">{s.heading}</h2>
        </Reveal>
      )}
      <div className="relative mx-auto aspect-square w-[min(86vw,520px)]">
        {[...order].reverse().map((idx, depth) => {
          const it = items[idx];
          const isTop = idx === top;
          const landscape = it.m.width >= it.m.height;
          const size = landscape ? { width: '92%', aspectRatio: `${it.m.width} / ${it.m.height}` } : { height: '92%', aspectRatio: `${it.m.width} / ${it.m.height}` };
          const flying = fly?.i === idx;
          return (
            <motion.div
              key={idx}
              className="absolute top-1/2 left-1/2 cursor-grab touch-pan-y bg-[#fdfdfb] p-[3%] pb-[9%] shadow-[0_6px_24px_rgba(0,0,0,.18)] active:cursor-grabbing"
              style={{ ...size, x: '-50%', y: '-50%', zIndex: depth }}
              initial={false}
              animate={flying ? { x: `${fly!.dir * 160 - 50}%`, rotate: fly!.dir * 28, opacity: 0 } : { x: '-50%', rotate: isTop ? 0 : it.rot, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 160, damping: 22 }}
              onAnimationComplete={() => {
                if (flying) {
                  setOrder((o) => [...o.slice(1), o[0]]);
                  setFly(null);
                }
              }}
              drag={isTop && !fly ? 'x' : false}
              dragSnapToOrigin
              onDragEnd={(_, info: PanInfo) => {
                if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) next(info.offset.x > 0 ? 1 : -1);
              }}
              onTap={() => isTop && next(1)}
            >
              <Img media={it.m} sizes="(max-width: 768px) 80vw, 480px" className="pointer-events-none h-full w-full" />
              {it.caption && <p className="absolute right-[5%] bottom-[1.5%] left-[5%] truncate font-hand text-[clamp(21px,3.4vw,28px)] text-[#444]">{it.caption}</p>}
            </motion.div>
          );
        })}
      </div>
      <div className="mt-8 flex items-center justify-center gap-4">
        <p className="t-caption text-muted tabular-nums">
          {top + 1} / {items.length}
        </p>
        <button type="button" onClick={() => next(1)} className="t-caption rounded-full border border-[var(--tone-line)] px-4 py-1.5">
          다음 장
        </button>
        <button type="button" onClick={() => openLightbox(slides, top)} className="t-caption text-[var(--tone-link)]">
          크게 보기
        </button>
      </div>
    </div>
  );
}

// ── Scrap Object — 실물 스크랩 ────────────────────────────────

function Tape({ className, rot }: { className: string; rot: number }) {
  return (
    <span
      aria-hidden
      className={`absolute z-10 h-[26px] w-[92px] ${className}`}
      style={{
        transform: `rotate(${rot}deg)`,
        background: 'rgba(238, 226, 178, .78)',
        boxShadow: '0 1px 2px rgba(0,0,0,.08)',
        clipPath: 'polygon(3% 0, 97% 4%, 100% 30%, 97% 60%, 100% 100%, 2% 96%, 0 66%, 3% 34%)',
      }}
    />
  );
}

export function ScrapObject({ section: s }: TemplateProps<'scrap-object'>) {
  const { media } = useStory();
  const reduce = useReducedMotion();
  const items = s.items.map((it, i) => ({ ...it, m: media[it.media], rot: Math.round(jitter(i, 5) * 80) / 10 }));
  const slides = items.map((it) => ({ media: it.m, caption: it.caption }));
  const cols = items.length === 1 ? '' : 'md:grid-cols-2';
  return (
    <div className="section-pad relative overflow-x-clip" style={{ background: '#f1eadb', color: '#3b3226' }}>
      <PaperGrain opacity={0.09} />
      {s.heading && (
        <Reveal className="mx-auto mb-10 max-w-[980px]">
          <h2 className="font-hand text-[clamp(44px,6vw,68px)] leading-none">{s.heading}</h2>
        </Reveal>
      )}
      <div className={`mx-auto grid max-w-[980px] items-start gap-x-12 gap-y-14 ${cols}`}>
        {items.map((it, i) => (
          <motion.figure
            key={i}
            className={`relative ${items.length > 1 && i % 2 ? 'md:mt-16' : ''}`}
            initial={reduce ? false : { opacity: 0, y: 24, rotate: it.rot * 1.8 }}
            whileInView={{ opacity: 1, y: 0, rotate: it.rot }}
            viewport={{ once: true, margin: '0px 0px -15% 0px' }}
            transition={{ type: 'spring', stiffness: 80, damping: 14, delay: i * 0.12 }}
          >
            <Tape className="-top-3 left-[8%]" rot={-8} />
            <Tape className="-top-3 right-[8%]" rot={7} />
            <div className="bg-white p-2 shadow-[0_3px_14px_rgba(0,0,0,.16)]">
              <Img media={it.m} sizes="(max-width: 768px) 86vw, 460px" className="w-full" style={{ aspectRatio: `${it.m.width} / ${it.m.height}` }} zoom={{ slides, index: i }} />
            </div>
            {it.caption && (
              <figcaption className="mt-3 flex items-start gap-2 font-hand text-[clamp(27px,3.4vw,34px)] leading-tight">
                <svg viewBox="0 0 40 30" className="mt-1 h-6 w-8 shrink-0" aria-hidden>
                  <path d="M 36 26 C 22 26 10 20 6 6 M 6 6 L 3 14 M 6 6 L 13 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                {it.caption}
              </figcaption>
            )}
          </motion.figure>
        ))}
      </div>
      {s.note && <p className="relative mx-auto mt-12 max-w-[640px] text-center font-hand text-[clamp(28px,3.6vw,36px)] leading-snug">{s.note}</p>}
    </div>
  );
}
