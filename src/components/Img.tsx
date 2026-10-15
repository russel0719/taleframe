'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { thumbHashToDataURL } from 'thumbhash';
import type { ClientMedia } from '@/lib/resolve';
import { useStoryOptional, type LightboxSlide } from './StoryContext';

type Props = {
  media: ClientMedia;
  /** <img sizes> — 레이아웃에서 실제로 차지하는 폭 */
  sizes: string;
  /** cover: 상자를 채우며 자른다 (focus 기준) / contain: 원본 비율 */
  fit?: 'cover' | 'contain';
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
  /** 누르면 라이트박스. 같은 묶음의 사진들과 그 안에서의 위치 */
  zoom?: { slides: LightboxSlide[]; index: number };
};

/**
 * 파생 webp 를 srcset 으로 내보내고, 로드 전에는 thumbhash 흐린 미리보기를 깐다.
 * next/image 대신 직접 쓰는 이유: 파생 파일을 이미 여러 폭으로 만들어 두었으므로 Vercel 이미지 최적화가 필요 없다.
 */
export function Img({ media, sizes, fit = 'cover', className = '', style, priority, zoom }: Props) {
  const story = useStoryOptional();
  const [loaded, setLoaded] = useState(false);
  const placeholder = useMemo(() => {
    try {
      return thumbHashToDataURL(Uint8Array.from(atob(media.img.thumbhash), (c) => c.charCodeAt(0)));
    } catch {
      return undefined;
    }
  }, [media.img.thumbhash]);

  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- 파생 파일을 미리 만들어 두어 next/image 최적화가 필요 없다
    <img
      src={media.img.src}
      srcSet={media.img.srcSet}
      sizes={sizes}
      width={media.width}
      height={media.height}
      alt={media.img.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      ref={(el) => {
        if (el?.complete && el.naturalWidth) setLoaded(true);
      }}
      onLoad={() => setLoaded(true)}
      className={`h-full w-full transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      style={{ objectFit: fit, objectPosition: media.img.position }}
    />
  );

  const wrapStyle: CSSProperties = {
    backgroundImage: placeholder && !loaded ? `url(${placeholder})` : undefined,
    backgroundSize: 'cover',
    backgroundPosition: media.img.position,
    ...style,
  };

  if (zoom && story) {
    return (
      <button
        type="button"
        className={`block cursor-zoom-in overflow-hidden ${className}`}
        style={wrapStyle}
        onClick={() => story.openLightbox(zoom.slides, zoom.index)}
        aria-label={media.img.alt ? `${media.img.alt} 크게 보기` : '사진 크게 보기'}
      >
        {img}
      </button>
    );
  }
  return (
    <div className={`overflow-hidden ${className}`} style={wrapStyle}>
      {img}
    </div>
  );
}
