'use client';

/**
 * 작품 템플릿 — 기록을 넘어 한 장면을 작품처럼 보여준다.
 * 모두 모션 줄이기 설정에서 정적인 대체 화면을 가진다.
 */
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionStyle,
  type MotionValue,
} from 'motion/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useMedia, useStory } from '@/components/StoryContext';
import type { ClientMedia } from '@/lib/resolve';
import type { TemplateProps } from './types';

// ── 공용 ─────────────────────────────────────────────────────

/** 스크롤 진행도 p 에서 [a, b] 구간 동안 0→1 */
function useWindow(p: MotionValue<number>, a: number, b: number) {
  return useTransform(p, [a, b], [0, 1], { clamp: true });
}

/** 상대 휘도 (0~1) — 색면 위 글자색을 고른다 */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 배경으로 깔 대표색. 채도 있는 어두운 색을 먼저 고른다 — DarkMuted 부터 고르면
 * 사진마다 비슷한 갈색이 나와 색이 바뀌는 느낌이 죽는다 (실험실에서 확인)
 */
function fieldColor(m: ClientMedia) {
  const p = m.palette;
  const pick = p.DarkVibrant ?? p.Vibrant ?? p.DarkMuted ?? p.Muted ?? '#272729';
  return luminance(pick) > 0.45 ? (p.DarkMuted ?? pick) : pick;
}

const formatTaken = (t?: string) => {
  if (!t) return undefined;
  const [d, hm] = t.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  return { date: `${y}. ${mo}. ${da}.`, time: hm };
};

/** 필름·종이 질감 — SVG 잡음. 장식이지만 '작품' 섹션에서만 쓴다 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

function Grain({ opacity = 0.08, animate = false }: { opacity?: number; animate?: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 mix-blend-overlay ${animate ? 'tf-grain' : ''}`}
      style={{ backgroundImage: GRAIN, opacity }}
    />
  );
}

// ── Verse — 세로쓰기 시 ───────────────────────────────────────

function VerseLine({ p, i, n, children }: { p: MotionValue<number>; i: number; n: number; children: ReactNode }) {
  const start = 0.08 + (i / n) * 0.7;
  const t = useWindow(p, start, start + 0.12);
  const opacity = useTransform(t, [0, 1], [0, 1]);
  const filter = useTransform(t, (v) => `blur(${(1 - v) * 6}px)`);
  return (
    <motion.span className="block" style={{ opacity, filter }}>
      {children}
    </motion.span>
  );
}

export function Verse({ section: s }: TemplateProps<'verse'>) {
  const m = useMedia(s.media);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const n = s.lines.length;

  const poem = (
    <div className="relative flex flex-col items-center gap-6">
      <div
        lang="ko"
        className="font-serif text-[clamp(17px,2.4vw,32px)] leading-[2.1] tracking-[0.12em]"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', height: 'min(60svh, 540px)' }}
      >
        {s.lines.map((l, i) =>
          reduce ? (
            <span key={i} className="block">
              {l}
            </span>
          ) : (
            <VerseLine key={i} p={scrollYProgress} i={i} n={n}>
              {l}
            </VerseLine>
          ),
        )}
      </div>
      <div className="flex items-center gap-3">
        {s.attribution && <p className="t-caption text-muted font-serif">{s.attribution}</p>}
        {/* 낙관 — 붉은 도장 */}
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-[3px] bg-[#b8322a] font-serif text-[15px] leading-none text-white/95">
          旅
        </span>
      </div>
    </div>
  );

  const scroll = m && (
    <div className="bg-canvas p-3 shadow-product md:p-4">
      <Img media={m} sizes="(max-width: 768px) 40vw, 340px" className="h-[min(50svh,420px)] w-[36vw] md:h-[min(68svh,560px)] md:w-[min(26vw,340px)]" zoom={{ slides: [{ media: m }], index: 0 }} />
    </div>
  );

  return (
    <div ref={ref} className="relative" style={{ height: reduce ? 'auto' : `${150 + n * 12}svh` }}>
      <div className={`${reduce ? '' : 'sticky top-0'} flex min-h-[100svh] flex-row-reverse items-center justify-center gap-5 px-4 py-16 md:gap-[8vw] md:px-6`}>
        {poem}
        {scroll}
        <Grain opacity={0.06} />
      </div>
    </div>
  );
}

// ── Color Field — 색면 ────────────────────────────────────────

function FieldLayer({ p, i, n, children }: { p: MotionValue<number>; i: number; n: number; children: ReactNode }) {
  const c = n === 1 ? 0 : i / (n - 1);
  const w = 0.5 / Math.max(1, n - 1);
  // 입력 구간은 반드시 0~1 안에서 증가해야 한다 — Motion 이 스크롤 애니메이션을 WAAPI 로 넘길 때
  // 범위를 벗어나거나 겹친 오프셋은 "Offsets must be monotonically non-decreasing" 로 페이지를 멈춘다
  const [range, values] =
    n === 1
      ? [[0, 1], [1, 1]]
      : i === 0
        ? [[0, c + w * 0.3, c + w], [1, 1, 0]]
        : i === n - 1
          ? [[c - w, c - w * 0.3, 1], [0, 1, 1]]
          : [[c - w, c - w * 0.3, c + w * 0.3, c + w], [0, 1, 1, 0]];
  const opacity = useTransform(p, range, values);
  const y = useTransform(p, [Math.max(0, c - w), Math.min(1, c + w)], [i === 0 ? 0 : 40, i === n - 1 ? 0 : -40]);
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center" style={{ opacity, y }}>
      {children}
    </motion.div>
  );
}

export function ColorField({ section: s }: TemplateProps<'color-field'>) {
  const { media } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const items = s.items.map((it) => ({ m: media[it.media], caption: it.caption }));
  const colors = items.map((it) => fieldColor(it.m));
  const inks = colors.map((c) => (luminance(c) > 0.35 ? '#1d1d1f' : '#ffffff'));
  const n = items.length;
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const stops = items.map((_, i) => (n === 1 ? 0 : i / (n - 1)));
  const bg = useTransform(scrollYProgress, n === 1 ? [0, 1] : stops, n === 1 ? [colors[0], colors[0]] : colors);
  const ink = useTransform(scrollYProgress, n === 1 ? [0, 1] : stops, n === 1 ? [inks[0], inks[0]] : inks);
  const slides = items.map((it) => ({ media: it.m, caption: it.caption }));

  const frame = (it: (typeof items)[number], i: number) => (
    <figure className="flex flex-col items-center gap-6">
      <Img
        media={it.m}
        sizes="(max-width: 768px) 78vw, 520px"
        className="w-[min(78vw,58svh,520px)] shadow-product"
        style={{ aspectRatio: `${it.m.width} / ${it.m.height}` }}
        zoom={{ slides, index: i }}
      />
      <figcaption className="flex items-center gap-3">
        <span className="h-7 w-7 rounded-[4px] ring-1 ring-white/30" style={{ background: colors[i] }} />
        <span className="font-mono text-[14px] tracking-[0.12em] uppercase opacity-85">{colors[i]}</span>
        {it.caption && <span className="t-body opacity-90">· {it.caption}</span>}
      </figcaption>
    </figure>
  );

  if (reduce) {
    return (
      <div>
        {items.map((it, i) => (
          <div key={i} className="section-pad grid place-items-center" style={{ background: colors[i], color: inks[i] }}>
            {frame(it, i)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className="relative" style={{ height: `${n * 90 + 40}svh`, backgroundColor: bg, color: ink }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        {s.heading && <p className="t-caption-strong absolute top-[calc(44px+3svh)] left-6 z-10 tracking-[0.2em] uppercase opacity-80 md:left-10">{s.heading}</p>}
        {items.map((it, i) => (
          <FieldLayer key={i} p={scrollYProgress} i={i} n={n}>
            {frame(it, i)}
          </FieldLayer>
        ))}
      </div>
    </motion.div>
  );
}

// ── Film Roll — 필름 ──────────────────────────────────────────

const SPROCKETS =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='14'%3E%3Crect x='7' y='2' width='12' height='10' rx='2' fill='%23e9e4d8'/%3E%3C/svg%3E\")";

export function FilmRoll({ section: s }: TemplateProps<'film-roll'>) {
  const { media } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [travel, setTravel] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], [0, -travel]);
  const items = s.items.map((it) => ({ m: media[it.media], caption: it.caption }));
  const slides = items.map((it) => ({ media: it.m, caption: it.caption }));
  const label = s.label ?? 'TALEFRAME';

  // 띠 전체 길이 - 화면 폭 = 가로로 흘러갈 거리
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => setTravel(Math.max(0, el.scrollWidth - window.innerWidth + 48));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const film = (
    <div ref={strip} className="relative inline-flex flex-col bg-[#0d0c0b] py-1" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,.04)' }}>
      <div aria-hidden className="h-[14px]" style={{ backgroundImage: SPROCKETS, backgroundRepeat: 'repeat-x' }} />
      <div className="flex gap-[14px] px-[14px] py-3">
        {items.map((it, i) => {
          const t = formatTaken(it.m.taken);
          return (
            <figure key={i} className="flex shrink-0 flex-col gap-2">
              <Img
                media={it.m}
                sizes="(max-width: 640px) 70vw, 420px"
                className="aspect-square h-[min(46svh,400px)] rounded-[2px] md:h-[min(52svh,420px)]"
                zoom={{ slides, index: i }}
              />
              <figcaption className="flex justify-between gap-4 font-mono text-[11px] tracking-[0.14em] text-[#f0a541]">
                <span>
                  {label} ▸ {String(i + 1).padStart(2, '0')}A
                </span>
                {t && <span>{t.time}</span>}
              </figcaption>
              {it.caption && <p className="t-caption max-w-[min(46svh,400px)] text-white/75">{it.caption}</p>}
            </figure>
          );
        })}
      </div>
      <div aria-hidden className="h-[14px]" style={{ backgroundImage: SPROCKETS, backgroundRepeat: 'repeat-x' }} />
    </div>
  );

  if (reduce) {
    return (
      <div className="section-pad bg-[#161514] text-white">
        {s.heading && <h2 className="t-display-md mb-8 text-center">{s.heading}</h2>}
        <div className="overflow-x-auto pb-4">{film}</div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative bg-[#161514] text-white" style={{ height: `${120 + items.length * 32}svh` }}>
      <div className="sticky top-0 flex h-[100svh] flex-col justify-center gap-8 overflow-hidden">
        {s.heading && (
          <Reveal className="px-6 text-center">
            <h2 className="t-display-md">{s.heading}</h2>
          </Reveal>
        )}
        <motion.div className="pl-6 md:pl-[8vw]" style={{ x, rotate: -1.2 }}>
          {film}
        </motion.div>
        <Grain opacity={0.12} animate />
      </div>
    </div>
  );
}

// ── Exhibition — 전시 벽 ──────────────────────────────────────

export function Diptych({ section: s }: TemplateProps<'diptych'>) {
  const { media } = useStory();
  const reduce = useReducedMotion();
  const works = s.works.map((w) => ({ ...w, m: media[w.media] }));
  const slides = works.map((w) => ({ media: w.m, caption: w.title }));
  const cols = works.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return (
    <div className="section-pad py-[clamp(80px,12svh,140px)]">
      {(s.heading || s.statement) && (
        <Reveal className="mx-auto mb-16 max-w-[1068px] md:mb-24">
          {s.heading && <h2 className="font-serif text-[clamp(28px,3.4vw,44px)] leading-tight">{s.heading}</h2>}
          {s.statement && <p className="t-body text-muted mt-5 max-w-[560px] font-serif leading-[1.9]">{s.statement}</p>}
        </Reveal>
      )}
      <div className={`mx-auto grid max-w-[1068px] items-end gap-x-[6vw] gap-y-16 ${cols}`}>
        {works.map((w, i) => {
          const t = formatTaken(w.m.taken);
          return (
            <motion.figure
              key={i}
              initial={reduce ? false : { opacity: 0, y: -18, rotate: i % 2 ? 1.2 : -1.2 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              viewport={{ once: true, margin: '0px 0px -15% 0px' }}
              transition={{ type: 'spring', stiffness: 70, damping: 13, delay: i * 0.15 }}
              className="flex flex-col"
            >
              {/* 액자: 얇은 검은 틀 + 흰 매트 */}
              <div className="border-[5px] border-[#1d1d1f] bg-canvas p-[clamp(14px,2.4vw,30px)] shadow-product">
                <Img
                  media={w.m}
                  sizes="(max-width: 768px) 80vw, 420px"
                  className="w-full"
                  style={{ aspectRatio: `${w.m.width} / ${w.m.height}` }}
                  zoom={{ slides, index: i }}
                />
              </div>
              {/* 작품 캡션 */}
              <figcaption className="mt-6 max-w-[260px] self-start border-l-2 border-[#1d1d1f]/70 pl-3">
                <p className="font-serif text-[17px] italic leading-snug">{w.title}</p>
                {t && <p className="t-fine text-muted mt-1 tabular-nums">{t.date}</p>}
                {w.note && <p className="t-caption text-muted mt-2 leading-relaxed">{w.note}</p>}
              </figcaption>
            </motion.figure>
          );
        })}
      </div>
    </div>
  );
}

// ── Spotlight — 어둠 속 빛 ────────────────────────────────────

export function Spotlight({ section: s }: TemplateProps<'spotlight'>) {
  const m = useMedia(s.media);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const [pointer, setPointer] = useState(false);
  const pointerMode = useMotionValue(0);
  const px = useMotionValue(50);
  const py = useMotionValue(50);
  // 마우스가 없으면(모바일) 스크롤에 따라 빛이 사진 위를 천천히 훑는다
  const pathX = useTransform(scrollYProgress, (p) => 50 + 30 * Math.sin(p * Math.PI * 2.2));
  const pathY = useTransform(scrollYProgress, (p) => 48 + 22 * Math.cos(p * Math.PI * 1.6));
  const tx = useTransform(() => (pointerMode.get() ? px.get() : pathX.get()));
  const ty = useTransform(() => (pointerMode.get() ? py.get() : pathY.get()));
  const sx = useSpring(tx, { stiffness: 120, damping: 22 });
  const sy = useSpring(ty, { stiffness: 120, damping: 22 });
  const r = useTransform(scrollYProgress, [0, 0.7, 0.92], [13, 24, 160]);
  const mask = useMotionTemplate`radial-gradient(circle at ${sx}% ${sy}%, #000 ${r}%, rgba(0,0,0,.35) calc(${r}% + 6%), transparent calc(${r}% + 14%))`;
  const captionOpacity = useTransform(scrollYProgress, [0.82, 0.95], [0, 1]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.12, 0.3], [0, 1, 0]);

  const caption = (s.caption || s.place) && (
    <div className="mx-auto max-w-[860px] px-6 text-center text-on-dark">
      {s.place && <p className="t-caption-strong mb-2 text-on-dark/75">{s.place}</p>}
      {s.caption && <p className="t-lead-airy">{s.caption}</p>}
    </div>
  );

  if (reduce) {
    return (
      <figure className="relative bg-void">
        <Img media={m} sizes="100vw" className="h-[90svh] w-full" />
        {caption && <figcaption className="section-pad">{caption}</figcaption>}
      </figure>
    );
  }

  return (
    <div ref={ref} className="relative bg-void" style={{ height: '240svh' }}>
      <div
        className="sticky top-0 h-[100svh] overflow-hidden"
        onPointerMove={(e) => {
          if (e.pointerType !== 'mouse') return;
          const b = e.currentTarget.getBoundingClientRect();
          px.set(((e.clientX - b.left) / b.width) * 100);
          py.set(((e.clientY - b.top) / b.height) * 100);
          if (!pointer) {
            pointerMode.set(1);
            setPointer(true);
          }
        }}
      >
        <motion.div className="absolute inset-0" style={{ maskImage: mask, WebkitMaskImage: mask }}>
          <Img media={m} sizes="100vw" className="h-full w-full" />
        </motion.div>
        <motion.p style={{ opacity: hintOpacity }} className="t-fine pointer-events-none absolute top-[calc(44px+4svh)] left-1/2 -translate-x-1/2 tracking-[0.2em] text-white/60">
          {pointer ? '빛을 움직여 보세요' : '내려가며 비춰 보세요'}
        </motion.p>
        {caption && (
          <motion.figcaption style={{ opacity: captionOpacity }} className="scrim-bottom absolute inset-x-0 bottom-0 pt-32 pb-12">
            {caption}
          </motion.figcaption>
        )}
      </div>
    </div>
  );
}

// ── Riso Print — 리소 인쇄 ────────────────────────────────────

const RISO_FALLBACK: [string, string] = ['#ff48b0', '#3255a4'];

function InkLayer({ m, ink, filter, halftone, style }: { m: ClientMedia; ink: string; filter: string; halftone?: boolean; style?: MotionStyle }) {
  return (
    <motion.div
      className="absolute inset-0"
      style={{
        background: ink,
        isolation: 'isolate',
        mixBlendMode: 'multiply',
        ...(halftone
          ? {
              maskImage: 'radial-gradient(circle, #000 52%, transparent 54%)',
              WebkitMaskImage: 'radial-gradient(circle, #000 52%, transparent 54%)',
              maskSize: '5px 5px',
              WebkitMaskSize: '5px 5px',
            }
          : {}),
        ...style,
      }}
    >
      {/* 흑백 사진을 screen 으로 얹으면 검은 곳=잉크, 흰 곳=종이 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 같은 파생 webp 를 잉크 판마다 겹쳐 쓴다 */}
      <img
        src={m.img.src}
        srcSet={m.img.srcSet}
        sizes="(max-width: 768px) 90vw, 640px"
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        style={{ objectPosition: m.img.position, filter, mixBlendMode: 'screen' }}
      />
    </motion.div>
  );
}

export function RisoPrint({ section: s }: TemplateProps<'riso-print'>) {
  const m = useMedia(s.media);
  const { openLightbox } = useStory();
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  // 판이 살짝 어긋난다 — 스크롤에 따라 조금씩 움직인다
  const dx = useTransform(scrollYProgress, [0, 1], reduce ? [3, 3] : [-6, 8]);
  const dy = useTransform(scrollYProgress, [0, 1], reduce ? [2, 2] : [5, -4]);
  const [ink1, ink2] = s.inks ?? [m.palette.Vibrant ?? RISO_FALLBACK[0], RISO_FALLBACK[1]];

  return (
    <div ref={ref} className="section-pad overflow-hidden" style={{ background: '#f4efe4', color: '#1d1d1f' }}>
      <div className="relative mx-auto max-w-[680px]">
        <button
          type="button"
          onClick={() => openLightbox([{ media: m, caption: s.caption }], 0)}
          className="relative block w-full cursor-zoom-in overflow-hidden"
          style={{ aspectRatio: `${m.width} / ${m.height}`, background: '#f4efe4' }}
          aria-label={m.img.alt ? `${m.img.alt} 원본 색으로 보기` : '원본 색으로 보기'}
        >
          <InkLayer m={m} ink={ink2} filter="grayscale(1) contrast(1.05) brightness(1.08)" halftone style={{ x: dx, y: dy }} />
          <InkLayer m={m} ink={ink1} filter="grayscale(1) contrast(1.9) brightness(1.25)" />
          <Grain opacity={0.18} />
        </button>
        {s.title && (
          <p
            className="pointer-events-none relative -mt-[0.55em] ml-[-0.04em] text-[clamp(56px,12vw,128px)] leading-[0.9] font-[850] tracking-[-0.04em] mix-blend-multiply"
            style={{ color: ink2, fontFamily: 'var(--font-display)' }}
          >
            {s.title}
          </p>
        )}
        {s.caption && <p className="t-caption mt-4 max-w-[480px] font-mono tracking-wide text-[#1d1d1f]/75">{s.caption}</p>}
      </div>
    </div>
  );
}

// ── Kinetic Type — 글자 속으로 ─────────────────────────────────

export function KineticType({ section: s }: TemplateProps<'kinetic-type'>) {
  const m = useMedia(s.media);
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const scale = useTransform(scrollYProgress, [0.1, 0.72], [1, 26]);
  const textOpacity = useTransform(scrollYProgress, [0.55, 0.72], [1, 0]);
  const imgOpacity = useTransform(scrollYProgress, [0.5, 0.7], [0, 1]);
  const captionOpacity = useTransform(scrollYProgress, [0.78, 0.92], [0, 1]);
  const chars = [...s.text];
  const size = `clamp(96px, ${Math.min(42, 92 / Math.max(1, chars.length))}vw, 340px)`;

  const filled: CSSProperties = m
    ? {
        backgroundImage: `url(${m.img.src})`,
        backgroundSize: 'cover',
        backgroundPosition: m.img.position,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      }
    : { color: '#fff' };

  if (reduce) {
    return (
      <div className="relative grid min-h-[80svh] place-items-center overflow-hidden bg-void text-white">
        {m && <Img media={m} sizes="100vw" className="absolute inset-0 h-full w-full opacity-60" />}
        <p className="relative font-[850] tracking-[-0.04em]" style={{ fontSize: size, fontFamily: 'var(--font-display)' }}>
          {s.text}
        </p>
        {s.caption && <p className="t-lead-airy relative px-6 pb-10 text-center">{s.caption}</p>}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative bg-void" style={{ height: '260svh' }}>
      <div className="sticky top-0 grid h-[100svh] place-items-center overflow-hidden text-white">
        {m && (
          <motion.div className="absolute inset-0" style={{ opacity: imgOpacity }}>
            <Img media={m} sizes="100vw" className="h-full w-full" />
          </motion.div>
        )}
        <motion.p
          className="relative leading-none font-[850] tracking-[-0.05em] whitespace-nowrap will-change-transform"
          style={{ scale, opacity: textOpacity, fontSize: size, fontFamily: 'var(--font-display)', ...filled }}
        >
          {s.text}
        </motion.p>
        {s.caption && (
          <motion.p style={{ opacity: captionOpacity }} className="t-lead-airy scrim-bottom absolute inset-x-0 bottom-0 px-6 pt-32 pb-12 text-center">
            {s.caption}
          </motion.p>
        )}
      </div>
    </div>
  );
}

// ── Palette Diary — 색의 일기 ─────────────────────────────────

/** 위(밝은 색)에서 아래(어두운 색)로 — 하늘에서 땅으로 읽히게 */
const STRIPE_ORDER = ['LightMuted', 'LightVibrant', 'Vibrant', 'Muted', 'DarkVibrant', 'DarkMuted'];

function stripe(m: ClientMedia): string {
  const cols = STRIPE_ORDER.map((k) => m.palette[k]).filter(Boolean);
  if (!cols.length) return '#8a8a8a';
  const step = 100 / cols.length;
  return `linear-gradient(180deg, ${cols.map((c, i) => `${c} ${(i * step).toFixed(1)}% ${((i + 1) * step).toFixed(1)}%`).join(', ')})`;
}

export function PaletteDiary({ section: s }: TemplateProps<'palette-diary'>) {
  const { media, openLightbox } = useStory();
  const reduce = useReducedMotion();
  const days = s.days.map((d) => {
    const items = d.items.map((id) => media[id]).sort((a, b) => (a.taken ?? '').localeCompare(b.taken ?? ''));
    return { label: d.label, items, from: items[0]?.taken?.slice(11), to: items[items.length - 1]?.taken?.slice(11) };
  });
  return (
    <div className="section-pad">
      {s.heading && (
        <Reveal className="mx-auto mb-12 max-w-[1068px]">
          <h2 className="font-serif text-[clamp(28px,3.4vw,44px)] leading-tight">{s.heading}</h2>
        </Reveal>
      )}
      <div className="mx-auto max-w-[1068px] space-y-10">
        {days.map((d, di) => (
          <div key={di} className="md:grid md:grid-cols-[120px_1fr] md:items-end md:gap-6">
            <p className="mb-3 font-serif text-[17px] md:mb-0 md:pb-6">{d.label}</p>
            <div>
              <div className="flex h-[clamp(120px,24svh,240px)] items-end gap-[2px]">
                {d.items.map((m, i) => (
                  <motion.button
                    key={m.id}
                    type="button"
                    onClick={() => openLightbox(d.items.map((x) => ({ media: x, caption: x.taken?.slice(11) })), i)}
                    aria-label={`${m.taken?.slice(11) ?? ''} 사진 보기`}
                    className="group relative h-full min-w-[3px] flex-1 cursor-zoom-in"
                    style={{ background: stripe(m), transformOrigin: '50% 100%' }}
                    initial={reduce ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, margin: '0px 0px -10% 0px' }}
                    transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1], delay: i * 0.025 }}
                  >
                    {/* 마우스를 올리면 그 줄의 사진이 떠오른다 */}
                    <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 hidden w-28 -translate-x-1/2 overflow-hidden rounded-[4px] shadow-product group-hover:block">
                      {/* eslint-disable-next-line @next/next/no-img-element -- 줄 위 미리보기 */}
                      <img src={m.img.fallback ?? m.full.srcSet[0].src} alt="" className="aspect-[4/3] w-full object-cover" />
                    </span>
                  </motion.button>
                ))}
              </div>
              <p className="mt-2 flex justify-between font-mono text-[11px] tracking-[0.12em] text-[var(--tone-muted)]">
                <span>{d.from}</span>
                <span>{d.items.length}</span>
                <span>{d.to}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
      {s.caption && <p className="t-caption text-muted mx-auto mt-10 max-w-[1068px] font-serif">{s.caption}</p>}
    </div>
  );
}
