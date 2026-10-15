'use client';

import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import type { ClientMedia } from '@/lib/resolve';

export default function CompareSlider({ before, after }: { before: ClientMedia; after: ClientMedia }) {
  const img = (m: ClientMedia) => (
    <ReactCompareSliderImage
      src={m.img.src}
      srcSet={m.img.srcSet}
      sizes="(max-width: 1100px) 94vw, 1068px"
      alt={m.img.alt}
      style={{ objectPosition: m.img.position }}
    />
  );
  return <ReactCompareSlider itemOne={img(before)} itemTwo={img(after)} className="h-full w-full" keyboardIncrement="5%" />;
}
