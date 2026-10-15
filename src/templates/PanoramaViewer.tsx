'use client';

import '@photo-sphere-viewer/core/index.css';
import { Viewer } from '@photo-sphere-viewer/core';
import { useEffect, useRef } from 'react';

export default function PanoramaViewer({ src, caption }: { src: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const viewer = new Viewer({
      container: ref.current,
      panorama: src,
      caption,
      navbar: ['zoom', 'caption', 'fullscreen'],
      defaultZoomLvl: 20,
      // 페이지 스크롤을 가로채지 않는다
      mousewheel: false,
      touchmoveTwoFingers: true,
    });
    return () => viewer.destroy();
  }, [src, caption]);
  return <div ref={ref} className="absolute inset-0" />;
}
