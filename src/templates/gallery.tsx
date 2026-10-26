'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { motion, useReducedMotion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { ColumnsPhotoAlbum, MasonryPhotoAlbum, RowsPhotoAlbum, type Photo } from 'react-photo-album';
import 'react-photo-album/rows.css';
import 'react-photo-album/masonry.css';
import 'react-photo-album/columns.css';
import { Img } from '@/components/Img';
import { Reveal } from '@/components/Reveal';
import { useStory, type LightboxSlide } from '@/components/StoryContext';
import type { ClientMedia } from '@/lib/resolve';
import type { TemplateProps } from './types';
import { arVar, fitStyle, FRAME, isWide } from './util';

function useItems(items: { media: string; caption?: string }[]) {
  const { media } = useStory();
  const resolved = items.map((it) => ({ media: media[it.media], caption: it.caption }));
  const slides: LightboxSlide[] = resolved;
  return { resolved, slides };
}

export function PhotoSingle({ section: s, first }: TemplateProps<'photo-single'>) {
  const { media } = useStory();
  const m = media[s.media];
  const portrait = m.height > m.width * 1.05;
  // 가로 사진이 아니면 'full' 이어도 화면 폭을 채우지 않는다 — 1:1 이 위아래로 잘렸다
  const size = s.size === 'full' && !isWide(m) ? 'wide' : (s.size ?? (portrait ? 'narrow' : 'wide'));
  const max = { narrow: 'max-w-[560px]', wide: 'max-w-[1068px]', full: 'max-w-none' }[size];
  const sizes = { narrow: '(max-width: 600px) 92vw, 560px', wide: '(max-width: 1100px) 94vw, 1068px', full: '100vw' }[size];
  return (
    <figure className={size === 'full' ? 'pb-section' : 'section-pad'}>
      <Reveal className={`mx-auto ${max}`}>
        <Img
          media={m}
          sizes={sizes}
          fit="cover"
          className={`w-full ${size === 'full' ? 'max-h-[100svh]' : 'rounded-sm'}`}
          style={size === 'full' ? { aspectRatio: `${m.width} / ${m.height}` } : fitStyle(m, 85)}
          priority={first}
          zoom={{ slides: [{ media: m, caption: s.caption }], index: 0 }}
        />
      </Reveal>
      {(s.caption || s.place) && (
        <figcaption className="mx-auto mt-5 max-w-[680px] px-6 text-center">
          {s.caption && <p className="t-body">{s.caption}</p>}
          {s.place && <p className="t-caption text-muted mt-1">{s.place}</p>}
        </figcaption>
      )}
    </figure>
  );
}

export function PhotoOverlay({ section: s, first }: TemplateProps<'photo-overlay'>) {
  const { media } = useStory();
  const m = media[s.media];
  // 가로 사진이 아니면 PC 에서는 어두운 바탕 가운데에 원래 비율로 — 자막은 그 사진 아래쪽에 덮인다
  const framed = !isWide(m);
  return (
    <figure className={`relative overflow-hidden text-on-dark ${framed ? 'md:flex md:justify-center md:bg-void md:py-[6svh]' : ''}`} style={arVar(m)}>
      <div className={`relative ${framed ? `md:overflow-hidden md:rounded-[4px] ${FRAME}` : ''}`}>
        <Img
          media={m}
          sizes={framed ? '(max-width: 768px) 100vw, 82svh' : '100vw'}
          className={`h-[min(100svh,max(70svh,56vw))] w-full ${framed ? 'md:h-full' : ''}`}
          priority={first}
          zoom={{ slides: [{ media: m, caption: s.caption }], index: 0 }}
        />
        <figcaption className="scrim-bottom pointer-events-none absolute inset-x-0 bottom-0 px-6 pt-32 pb-10">
          <Reveal className="mx-auto max-w-[980px]">
            {s.place && <p className="t-caption-strong mb-2 text-on-dark/80">{s.place}</p>}
            <p className="t-lead">{s.caption}</p>
          </Reveal>
        </figcaption>
      </div>
    </figure>
  );
}

const toPhoto = (m: ClientMedia, i: number): Photo & { index: number } => ({
  key: m.id,
  index: i,
  src: m.img.src,
  width: m.width,
  height: m.height,
  alt: m.img.alt,
  srcSet: m.full.srcSet,
});

export function PhotoGallery({ section: s }: TemplateProps<'photo-gallery'>) {
  const { resolved, slides } = useItems(s.items);
  const { openLightbox } = useStory();
  const photos = resolved.map((r, i) => toPhoto(r.media, i));
  const common = {
    photos,
    onClick: ({ index }: { index: number }) => openLightbox(slides, index),
    sizes: { size: '1068px', sizes: [{ viewport: '(max-width: 1100px)', size: 'calc(100vw - 44px)' }] },
    defaultContainerWidth: 1068,
  };
  return (
    <div className="section-pad">
      <div className="mx-auto max-w-[1068px]">
        {s.heading && (
          <Reveal>
            <h2 className="t-display-md mb-8 text-center">{s.heading}</h2>
          </Reveal>
        )}
        <Reveal>
          {s.layout === 'rows' && <RowsPhotoAlbum {...common} targetRowHeight={(w) => (w < 640 ? 180 : 300)} spacing={8} />}
          {s.layout === 'masonry' && <MasonryPhotoAlbum {...common} columns={(w) => (w < 640 ? 2 : 3)} spacing={8} />}
          {s.layout === 'columns' && <ColumnsPhotoAlbum {...common} columns={(w) => (w < 640 ? 2 : 3)} spacing={8} />}
        </Reveal>
        {s.caption && <p className="t-body text-muted mx-auto mt-6 max-w-[680px] text-center">{s.caption}</p>}
      </div>
    </div>
  );
}

function Arrow({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d={dir === 'left' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhotoStrip({ section: s }: TemplateProps<'photo-strip'>) {
  const { resolved, slides } = useItems(s.items);
  const [ref, api] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', dragFree: true });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const update = useCallback(() => {
    if (!api) return;
    setCanPrev(api.canScrollPrev());
    setCanNext(api.canScrollNext());
  }, [api]);
  useEffect(() => {
    if (!api) return;
    const raf = requestAnimationFrame(update);
    api.on('select', update).on('reInit', update).on('scroll', update);
    return () => {
      cancelAnimationFrame(raf);
      api.off('select', update).off('reInit', update).off('scroll', update);
    };
  }, [api, update]);

  return (
    <div className="section-pad !px-0">
      {s.heading && (
        <Reveal>
          <h2 className="t-display-md mb-8 px-6 text-center">{s.heading}</h2>
        </Reveal>
      )}
      <div className="overflow-hidden" ref={ref}>
        <div className="flex gap-3 px-[max(22px,calc((100vw-1068px)/2))]">
          {resolved.map((r, i) => (
            <figure key={i} className="shrink-0">
              <Img
                media={r.media}
                sizes="(max-width: 640px) 80vw, 520px"
                className="h-[min(60svh,460px)] rounded-sm"
                style={{ aspectRatio: `${r.media.width} / ${r.media.height}` }}
                zoom={{ slides, index: i }}
              />
              {r.caption && <figcaption className="t-caption text-muted mt-3 max-w-[320px]">{r.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-6 flex max-w-[1068px] justify-end gap-3 px-6">
        <button type="button" className="btn-chip disabled:opacity-40" onClick={() => api?.scrollPrev()} disabled={!canPrev} aria-label="이전 사진">
          <Arrow dir="left" />
        </button>
        <button type="button" className="btn-chip disabled:opacity-40" onClick={() => api?.scrollNext()} disabled={!canNext} aria-label="다음 사진">
          <Arrow dir="right" />
        </button>
      </div>
    </div>
  );
}

/** 인덱스로 정해지는 기울기 — 렌더마다 바뀌지 않게 */
const TILT = [-4, 3, -2, 5, -3, 2];

export function PolaroidCollage({ section: s }: TemplateProps<'polaroid-collage'>) {
  const { resolved, slides } = useItems(s.items);
  const reduce = useReducedMotion();
  return (
    <div className="section-pad overflow-hidden">
      {s.heading && (
        <Reveal>
          <h2 className="t-display-md mb-12 text-center">{s.heading}</h2>
        </Reveal>
      )}
      <div className="mx-auto flex max-w-[1068px] flex-wrap justify-center gap-x-6 gap-y-10">
        {resolved.map((r, i) => (
          <motion.figure
            key={i}
            className="w-[min(300px,80vw)] bg-canvas p-3 pb-4 text-ink shadow-product"
            initial={reduce ? false : { opacity: 0, y: -60, rotate: TILT[i % 6] * 3 }}
            whileInView={{ opacity: 1, y: 0, rotate: TILT[i % 6] }}
            viewport={{ once: true, margin: '0px 0px -10% 0px' }}
            transition={{ type: 'spring', stiffness: 90, damping: 14, delay: i * 0.12 }}
          >
            <Img media={r.media} sizes="300px" className="aspect-square w-full" zoom={{ slides, index: i }} />
            <figcaption className="t-body mt-3 min-h-[1.5em] text-center">{r.caption}</figcaption>
          </motion.figure>
        ))}
      </div>
    </div>
  );
}

const CompareSlider = dynamic(() => import('./CompareSlider'), {
  ssr: false,
  loading: () => <div className="aspect-[3/2] w-full animate-pulse rounded-sm bg-tile-2" />,
});

export function BeforeAfter({ section: s }: TemplateProps<'before-after'>) {
  const { media } = useStory();
  const a = media[s.before.media];
  const b = media[s.after.media];
  return (
    <figure className="section-pad">
      <Reveal className="mx-auto max-w-[1068px]">
        <div className="relative overflow-hidden rounded-sm" style={{ aspectRatio: `${a.width} / ${a.height}` }}>
          <CompareSlider before={a} after={b} />
          {s.before.label && <span className="t-caption-strong pointer-events-none absolute top-4 left-4 rounded-pill bg-black/55 px-3 py-1 text-on-dark">{s.before.label}</span>}
          {s.after.label && <span className="t-caption-strong pointer-events-none absolute top-4 right-4 rounded-pill bg-black/55 px-3 py-1 text-on-dark">{s.after.label}</span>}
        </div>
      </Reveal>
      {s.caption && <figcaption className="t-body text-muted mx-auto mt-5 max-w-[680px] text-center">{s.caption}</figcaption>}
    </figure>
  );
}
