'use client';

/**
 * 손에 쥐는 기록물 — 스탬프 카드 · 승차권 · 하루 시계 · 밀착 인화지 · 사진 지도.
 * 사실(가게 이름·시각·장소)은 섹션에 적힌 것과 촬영 시각만 쓴다. 모르는 칸은 비워 둔다.
 * 스크롤 연동 값은 함수형 useTransform 으로만 만든다 (구간 배열을 WAAPI 로 넘기다 렌더가 멈춘 적이 있다).
 */
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';
import dynamic from 'next/dynamic';
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useStory } from '@/components/StoryContext';
import type { ClientMedia } from '@/lib/resolve';
import { hoursOf, skyAt, sunTimes } from '@/lib/sun';
import type { TemplateProps } from './types';

const PhotoMapCanvas = dynamic(() => import('./map/PhotoMapCanvas'), { ssr: false });

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** 인덱스로 정하는 흔들림 — 렌더마다 바뀌지 않게 */
const jitter = (i: number, seed = 1) => {
  const x = Math.sin((i + 1) * 12.9898 * seed) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};
/** 묶음의 대표 비율(중앙값) — 칸 모양을 사진에 맞춘다. 1:1 을 3:2 칸에 넣으면 위아래가 잘렸다 */
const typicalRatio = (ms: ClientMedia[]) => {
  const rs = ms.map((m) => m.width / m.height).sort((a, b) => a - b);
  return rs.length ? rs[Math.floor(rs.length / 2)].toFixed(4) : '1.5';
};
const shortDate = (t?: string) => (t ? `${Number(t.slice(5, 7))}/${Number(t.slice(8, 10))}` : undefined);
/** 작은 썸네일 — AVIF 를 못 읽는 브라우저도 있는 webp 대체본을 먼저 */
export const thumbSrc = (m: ClientMedia) => m.img.fallback ?? m.full.srcSet[0].src;

// ── Stamp Rally — 스탬프 카드 ─────────────────────────────────

const INK = '#c2272d';

function Stamp({ m, name, i, onOpen, reduce }: { m: ClientMedia; name?: string; i: number; onOpen: () => void; reduce: boolean }) {
  const rot = Math.round(jitter(i) * 180) / 10;
  const label = name ?? '?';
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      aria-label={name ? `${name} 사진 보기` : '이름 모르는 집 사진 보기'}
      className="relative aspect-square w-full cursor-zoom-in"
      initial={reduce ? false : { opacity: 0, scale: 1.7, rotate: rot - 14 }}
      whileInView={{ opacity: 0.94, scale: 1, rotate: rot }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ type: 'spring', stiffness: 420, damping: 18, delay: i * 0.16 }}
    >
      {/* 사진을 흑백으로 바꿔 붉은 잉크 위에 screen 으로 얹으면 어두운 곳만 잉크가 남는다 */}
      <span className="absolute inset-[16%] overflow-hidden rounded-full" style={{ background: INK, isolation: 'isolate' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 같은 파생 webp 를 잉크 효과로 쓴다 */}
        <img
          src={thumbSrc(m)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          style={{ objectPosition: m.img.position, filter: 'grayscale(1) contrast(1.6) brightness(1.15)', mixBlendMode: 'screen' }}
        />
      </span>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <path id={`arc-${m.id}-${i}`} d="M 14 50 A 36 36 0 0 1 86 50" />
        </defs>
        <circle cx="50" cy="50" r="47" fill="none" stroke={INK} strokeWidth="2.6" />
        <circle cx="50" cy="50" r="42.5" fill="none" stroke={INK} strokeWidth="1" />
        <text fill={INK} fontSize="9.5" fontWeight="700" letterSpacing="1.5" textAnchor="middle">
          <textPath href={`#arc-${m.id}-${i}`} startOffset="50%">
            {label}
          </textPath>
        </text>
        <text x="50" y="94" fill={INK} fontSize="6.5" fontWeight="700" textAnchor="middle" letterSpacing="1">
          No.{i + 1}
        </text>
      </svg>
    </motion.button>
  );
}

export function StampRally({ section: s }: TemplateProps<'stamp-rally'>) {
  const { media, openLightbox } = useStory();
  const reduce = useReducedMotion() ?? false;
  const stamps = s.stamps.map((st) => ({ ...st, m: media[st.media] }));
  const slides = stamps.map((st) => ({ media: st.m, caption: [st.name, st.note].filter(Boolean).join(' — ') || undefined }));
  const cols = stamps.length <= 4 ? 'grid-cols-2 md:grid-cols-4' : stamps.length <= 6 ? 'grid-cols-3' : 'grid-cols-3 md:grid-cols-4';
  // 찍히기 전 도장은 1.7배라 모바일에서 화면 밖으로 나간다 — 가로만 자른다
  return (
    <div className="section-pad overflow-x-clip">
      {s.heading && (
        <Reveal className="mx-auto mb-10 max-w-[860px] text-center">
          <h2 className="t-display-md">{s.heading}</h2>
        </Reveal>
      )}
      <div className="mx-auto max-w-[860px] rounded-[14px] border border-[#d9cfb8] bg-[#fbf7ec] p-[clamp(18px,4vw,44px)] text-[#3a2f24] shadow-product">
        <div className="mb-8 flex items-baseline justify-between gap-4 border-b border-dashed border-[#cdbf9f] pb-4">
          <p className="font-serif text-[clamp(20px,3vw,30px)] font-semibold">{s.card ?? 'STAMP CARD'}</p>
          <p className="font-mono text-[12px] tracking-[0.14em] text-[#8a7a62]">
            {stamps.length} / {stamps.length}
          </p>
        </div>
        <ol className={`grid gap-x-[clamp(14px,3vw,36px)] gap-y-8 ${cols}`}>
          {stamps.map((st, i) => (
            <li key={i} className="flex flex-col items-center gap-2">
              <div className="relative w-full max-w-[150px] rounded-full border-2 border-dotted border-[#cdbf9f] p-1">
                <Stamp m={st.m} name={st.name} i={i} reduce={reduce} onOpen={() => openLightbox(slides, i)} />
              </div>
              <p className="font-mono text-[11px] tracking-[0.1em] text-[#8a7a62]">{shortDate(st.m.taken) ?? `No.${i + 1}`}</p>
              {st.note && <p className="t-caption max-w-[180px] text-center text-[#5b4c3b]">{st.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ── Transit Ticket — 승차권 ───────────────────────────────────

const MODE: Record<string, [string, string]> = {
  walk: ['WALK', '도보'],
  train: ['RAIL', '기차'],
  subway: ['METRO', '지하철'],
  bus: ['BUS', '버스'],
  car: ['CAR', '자동차'],
  taxi: ['TAXI', '택시'],
  plane: ['FLIGHT', '비행기'],
  ferry: ['FERRY', '페리'],
  bike: ['BIKE', '자전거'],
};

/** 바코드 줄 굵기 — 출발·도착 글자로 정해진다 (장식, 정보 아님) */
function barWidths(seed: string): number[] {
  const out: number[] = [];
  for (let i = 0, h = 7; i < 34; i++) {
    h = (h * 31 + seed.charCodeAt(i % seed.length)) % 997;
    out.push(1 + (h % 3));
  }
  return out;
}

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => barWidths(seed), [seed]);
  return (
    <div aria-hidden className="flex h-10 items-stretch gap-[2px]">
      {bars.map((w, i) => (
        <span key={i} className="bg-[#1d1d1f]" style={{ width: w }} />
      ))}
    </div>
  );
}

export function TransitTicket({ section: s }: TemplateProps<'transit-ticket'>) {
  const { media } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // 표가 화면 가운데를 지나면 절취선에서 떨어져 나간다
  const tear = useTransform(scrollYProgress, (p) => (reduce ? 0 : clamp01((p - 0.42) / 0.2)));
  const stubRotate = useTransform(tear, (t) => t * 9);
  const stubY = useTransform(tear, (t) => t * 26);
  const stubX = useTransform(tear, (t) => t * 14);
  const [en, ko] = MODE[s.mode];
  const items = (s.items ?? []).map((it) => ({ m: media[it.media], caption: it.caption }));
  const slides = items.map((it) => ({ media: it.m, caption: it.caption }));
  const field = (label: string, value?: string) =>
    value && (
      <div>
        <p className="font-mono text-[10px] tracking-[0.16em] text-[#7a7a7a] uppercase">{label}</p>
        <p className="mt-0.5 text-[15px] font-semibold whitespace-nowrap tabular-nums md:text-[17px]">{value}</p>
      </div>
    );
  const notch = 'absolute h-6 w-6 rounded-full bg-[var(--tone-bg)]';

  return (
    <div ref={ref} className="section-pad overflow-x-clip">
      <div className="mx-auto flex max-w-[760px] flex-col md:flex-row">
        {/* 본권 */}
        <div className="relative flex-1 rounded-t-[14px] bg-[#fdfcf8] p-[clamp(20px,4vw,36px)] text-ink shadow-product md:rounded-t-none md:rounded-l-[14px]">
          <div className="mb-6 flex items-center justify-between">
            <p className="rounded-full bg-primary px-3 py-1 font-mono text-[11px] font-bold tracking-[0.2em] text-white">{en}</p>
            {s.operator && <p className="t-caption text-muted">{s.operator}</p>}
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="font-mono text-[10px] tracking-[0.16em] text-[#7a7a7a]">FROM</p>
              <p className="truncate text-[clamp(26px,5vw,40px)] leading-tight font-[700] tracking-[-0.02em]">{s.from}</p>
            </div>
            <p aria-label={`${ko}로`} className="pb-2 text-[22px] text-primary">
              →
            </p>
            <div className="min-w-0 text-right">
              <p className="font-mono text-[10px] tracking-[0.16em] text-[#7a7a7a]">TO</p>
              <p className="truncate text-[clamp(26px,5vw,40px)] leading-tight font-[700] tracking-[-0.02em]">{s.to}</p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-dashed border-hairline pt-5">
            {field('date', s.date?.slice(2).replaceAll('-', '.'))}
            {field('depart', s.depart)}
            {field('arrive', s.arrive)}
          </div>
        </div>
        {/* 절취선 */}
        <div aria-hidden className="relative h-0 border-t-2 border-dashed border-[#d6d6d6] md:h-auto md:w-0 md:border-t-0 md:border-l-2">
          <span className={`${notch} -top-3 -left-3 md:-top-3`} />
          <span className={`${notch} -top-3 -right-3 md:top-auto md:-bottom-3 md:-left-3`} />
        </div>
        {/* 떼어지는 쪽 */}
        <motion.div
          style={{ rotate: stubRotate, y: stubY, x: stubX, transformOrigin: '0% 0%' }}
          className="flex items-center justify-between gap-4 rounded-b-[14px] bg-[#fdfcf8] p-5 text-ink shadow-product md:w-[180px] md:flex-col md:items-start md:rounded-b-none md:rounded-r-[14px]"
        >
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-[#7a7a7a]">{en}</p>
            <p className="mt-1 text-[15px] font-semibold">
              {s.from} → {s.to}
            </p>
          </div>
          <Barcode seed={`${s.from}${s.to}`} />
        </motion.div>
      </div>
      {s.note && (
        <Reveal className="mx-auto mt-10 max-w-[640px] text-center">
          <p className="t-body">{s.note}</p>
        </Reveal>
      )}
      {items.length > 0 && (
        <div className={`mx-auto mt-10 grid max-w-[980px] gap-3 ${items.length > 1 ? 'grid-cols-2' : ''} ${items.length > 2 ? 'md:grid-cols-4' : ''}`}>
          {items.map((it, i) => (
            <figure key={i}>
              <Img media={it.m} sizes="(max-width: 768px) 48vw, 245px" className="w-full rounded-sm" style={{ aspectRatio: typicalRatio(items.map((x) => x.m)) }} zoom={{ slides, index: i }} />
              {it.caption && <figcaption className="t-caption text-muted mt-2">{it.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Day Clock — 하루 시계 ─────────────────────────────────────

/** 24시 원형 다이얼에서 시각 h 의 각도 — 정오가 위, 자정이 아래 */
const angleOf = (h: number) => ((h / 24) * 360 + 180) % 360;
const onDial = (h: number, r: number) => {
  const a = (angleOf(h) * Math.PI) / 180;
  const r3 = (v: number) => Math.round(v * 1000) / 1000; // 서버·브라우저 끝자리 차이로 하이드레이션이 어긋나지 않게
  return { x: r3(50 + r * Math.sin(a)), y: r3(50 - r * Math.cos(a)) };
};
const fmt = (h: number) => {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function DayClock({ section: s }: TemplateProps<'day-clock'>) {
  const { media, openLightbox } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const items = s.items
    .map((it) => ({ m: media[it.media], caption: it.caption }))
    .filter((it) => it.m.taken)
    .sort((a, b) => a.m.taken!.localeCompare(b.m.taken!))
    .map((it) => ({ ...it, h: hoursOf(it.m.taken!) }));
  const slides = items.map((it) => ({ media: it.m, caption: it.caption ?? fmt(it.h) }));
  const sun = sunTimes(s.date, s.place.lat, s.place.lng, s.utcOffset);
  const h0 = Math.max(0, (items[0]?.h ?? 8) - 0.4);
  const h1 = Math.min(23.99, (items[items.length - 1]?.h ?? 20) + 0.4);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const hour = useTransform(scrollYProgress, (p) => h0 + (h1 - h0) * clamp01((p - 0.06) / 0.86));
  const sky = useTransform(hour, (h) => {
    const [top, bottom] = skyAt(h, sun);
    return `linear-gradient(180deg, ${top}, ${bottom})`;
  });
  const hand = useTransform(hour, (h) => angleOf(h));
  const [now, setNow] = useState(h0);
  useMotionValueEvent(hour, 'change', (h) => setNow(Math.round(h * 12) / 12));
  const current = items.reduce((acc, it, i) => (it.h <= now + 1 / 60 ? i : acc), 0);

  const dial = (live: boolean) => (
    <div className="relative aspect-square w-[min(88vw,64svh,600px)]">
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="0.4" />
        {sun &&
          (() => {
            const a = onDial(sun.rise, 44);
            const b = onDial(sun.set, 44);
            const large = sun.set - sun.rise > 12 ? 1 : 0;
            return <path d={`M ${a.x} ${a.y} A 44 44 0 ${large} 1 ${b.x} ${b.y}`} fill="none" stroke="rgba(255,214,120,.75)" strokeWidth="1.1" strokeLinecap="round" />;
          })()}
        {Array.from({ length: 24 }, (_, h) => {
          const a = onDial(h, 47.5);
          const b = onDial(h, h % 6 ? 46.2 : 45);
          return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,.55)" strokeWidth={h % 6 ? 0.25 : 0.5} />;
        })}
        {[0, 6, 12, 18].map((h) => {
          const p = onDial(h, 40.5);
          return (
            <text key={h} x={p.x} y={p.y + 1.2} fill="rgba(255,255,255,.7)" fontSize="3" textAnchor="middle" fontFamily="ui-monospace, monospace">
              {h}
            </text>
          );
        })}
      </svg>
      {live && (
        <motion.div className="absolute inset-0" style={{ rotate: hand }} aria-hidden>
          <span className="absolute top-[4%] left-1/2 h-[46%] w-[2px] -translate-x-1/2 rounded-full bg-white/85" />
        </motion.div>
      )}
      {items.map((it, i) => {
        const p = onDial(it.h, 44);
        const on = !live || i <= current;
        return (
          <button
            key={i}
            type="button"
            onClick={() => openLightbox(slides, i)}
            aria-label={`${fmt(it.h)} 사진 보기`}
            className="absolute h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full ring-2 transition-all duration-500"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              opacity: on ? 1 : 0.35,
              transform: `translate(-50%, -50%) scale(${live && i === current ? 1.25 : 1})`,
              boxShadow: live && i === current ? '0 0 0 3px rgba(255,255,255,.9)' : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 다이얼 위 작은 썸네일 */}
            <img src={thumbSrc(it.m)} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: it.m.img.position }} />
          </button>
        );
      })}
      {live && items[current] && (
        <div className="absolute inset-[22%] overflow-hidden rounded-full shadow-[0_10px_40px_rgba(0,0,0,.35)]">
          {items.map((it, i) => (
            <div key={i} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === current ? 1 : 0 }}>
              <Img media={it.m} sizes="(max-width: 768px) 56vw, 340px" className="h-full w-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (reduce) {
    const [top, bottom] = skyAt(12, sun);
    return (
      <div className="section-pad flex flex-col items-center gap-10 text-white" style={{ background: `linear-gradient(180deg, ${top}, ${bottom})` }}>
        {s.heading && <h2 className="t-display-md text-center">{s.heading}</h2>}
        {dial(false)}
        <ol className="grid w-full max-w-[860px] grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((it, i) => (
            <li key={i}>
              <Img media={it.m} sizes="(max-width: 768px) 45vw, 210px" className="aspect-square w-full rounded-sm" zoom={{ slides, index: i }} />
              <p className="mt-2 font-mono text-[13px] tabular-nums">{fmt(it.h)}</p>
              {it.caption && <p className="t-caption text-white/80">{it.caption}</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const cap = items[current]?.caption;
  return (
    <motion.div ref={ref} className="relative text-white" style={{ height: `${130 + items.length * 26}svh`, backgroundImage: sky }}>
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center gap-5 overflow-hidden px-4">
        <div className="text-center">
          {s.heading && <p className="t-caption-strong tracking-[0.2em] text-white/75 uppercase">{s.heading}</p>}
          <p className="mt-1 font-mono text-[clamp(30px,6vw,52px)] leading-none font-light tabular-nums">{fmt(now)}</p>
          <p className="t-fine mt-2 text-white/65">
            {s.place.name}
            {sun && ` · 해 ${fmt(sun.rise)} – ${fmt(sun.set)}`}
          </p>
        </div>
        {dial(true)}
        <p className="t-body min-h-[1.6em] max-w-[560px] text-center text-white/90">{cap ?? ''}</p>
      </div>
    </motion.div>
  );
}

// ── Contact Sheet — 밀착 인화지 ───────────────────────────────

/** 손으로 그린 동그라미 — 살짝 겹치며 끝난다 */
function circlePath(i: number) {
  // 소수 둘째 자리에서 자른다 — 서버와 브라우저의 부동소수 끝자리가 달라 하이드레이션이 어긋났다
  const j = (k: number) => Math.round(jitter(i, k) * 600) / 100;
  return `M ${10 + j(1)} ${52 + j(2)} C ${8 + j(3)} ${14 + j(4)}, ${92 + j(5)} ${10 + j(6)}, ${95 + j(7)} ${48 + j(8)} C ${97 + j(9)} ${88 + j(10)}, ${8 + j(11)} ${92 + j(12)}, ${5 + j(13)} ${55 + j(14)} C ${4 + j(15)} ${38 + j(16)}, ${18 + j(17)} ${20 + j(18)}, ${36 + j(19)} ${14 + j(20)}`;
}

export function ContactSheet({ section: s }: TemplateProps<'contact-sheet'>) {
  const { media } = useStory();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.35 });
  const frames = s.frames.map((f) => ({ ...f, m: media[f.media] }));
  const slides = frames.map((f, i) => ({ media: f.m, caption: f.caption ?? `${i + 1}A` }));
  const label = s.label ?? 'TALEFRAME';
  const frameRatio = typicalRatio(frames.map((f) => f.m));
  let pickNo = 0;
  return (
    <div className="section-pad bg-[#141414] text-white">
      {s.heading && (
        <Reveal className="mx-auto mb-10 max-w-[1068px]">
          <h2 className="t-display-md">{s.heading}</h2>
        </Reveal>
      )}
      <div ref={ref} className="mx-auto max-w-[1068px] bg-[#0b0b0b] p-[clamp(10px,2vw,22px)] shadow-product">
        <p className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#f0a541]/80">
          {label} · {frames.length} FRAMES
        </p>
        <ol className="grid grid-cols-3 gap-x-[6px] gap-y-4 md:grid-cols-4 md:gap-x-[10px]">
          {frames.map((f, i) => {
            const n = f.pick ? pickNo++ : -1;
            return (
              <li key={i} className={`relative ${f.pick ? 'z-10' : ''}`}>
                <Img media={f.m} sizes="(max-width: 768px) 32vw, 260px" className={`w-full ${f.pick ? '' : 'opacity-80'}`} style={{ aspectRatio: frameRatio }} zoom={{ slides, index: i }} />
                <p className="mt-1 flex justify-between font-mono text-[10px] tracking-[0.12em] text-[#f0a541]">
                  <span>{i + 1}A</span>
                  <span className="text-white/40">{f.m.taken?.slice(11)}</span>
                </p>
                {f.pick && (
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute -inset-[9%] h-[118%] w-[118%] overflow-visible" aria-hidden>
                    <motion.path
                      d={circlePath(i)}
                      fill="none"
                      stroke="#e0352b"
                      // non-scaling-stroke 를 쓰면 pathLength 애니메이션이 화면 크기 기준으로 계산돼 데스크톱에서 반만 그려졌다
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      initial={reduce ? false : { pathLength: 0 }}
                      animate={seen || reduce ? { pathLength: 1 } : { pathLength: 0 }}
                      transition={{ duration: 0.7, ease: 'easeInOut', delay: 0.3 + n * 0.45 }}
                    />
                  </svg>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      {(s.caption || frames.some((f) => f.pick && f.caption)) && (
        <div className="mx-auto mt-8 max-w-[1068px] space-y-2">
          {frames.map((f, i) =>
            f.pick && f.caption ? (
              <p key={i} className="t-body text-white/85">
                <span className="mr-3 font-mono text-[13px] text-[#e0352b]">{i + 1}A</span>
                {f.caption}
              </p>
            ) : null,
          )}
          {s.caption && <p className="t-caption text-white/60">{s.caption}</p>}
        </div>
      )}
    </div>
  );
}

// ── Photo Map — 사진 지도 ─────────────────────────────────────

export function PhotoMap({ section: s }: TemplateProps<'photo-map'>) {
  const { media, openLightbox } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: '400px 0px' });
  const points = s.points.map((p) => ({ ...p, m: media[p.media] }));
  const slides = points.map((p) => ({ media: p.m, caption: p.caption }));
  const box: CSSProperties = { background: 'var(--color-parchment)' };
  return (
    <div className="section-pad">
      {s.heading && (
        <Reveal className="mx-auto mb-8 max-w-[1068px]">
          <h2 className="t-display-md">{s.heading}</h2>
        </Reveal>
      )}
      <div ref={ref} className="relative mx-auto h-[min(72svh,640px)] max-w-[1068px] overflow-hidden rounded-[18px]" style={box}>
        {near && <PhotoMapCanvas points={points.map((p) => ({ lat: p.lat, lng: p.lng, thumb: thumbSrc(p.m), position: p.m.img.position }))} onPick={(i) => openLightbox(slides, i)} />}
      </div>
      <p className="t-caption text-muted mx-auto mt-3 max-w-[1068px]">
        {s.caption ? `${s.caption} · ` : ''}사진 {points.length}장 · 위치는 약 100m 단위
      </p>
    </div>
  );
}
