'use client';

import YARL from 'yet-another-react-lightbox';
import Captions from 'yet-another-react-lightbox/plugins/captions';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/captions.css';
import type { LightboxSlide } from './StoryContext';

export default function Lightbox({ slides, index, onClose }: { slides: LightboxSlide[]; index: number; onClose: () => void }) {
  return (
    <YARL
      open
      close={onClose}
      index={index}
      plugins={[Zoom, Captions]}
      captions={{ descriptionTextAlign: 'center' }}
      controller={{ closeOnBackdropClick: true }}
      carousel={{ finite: slides.length < 3 }}
      slides={slides.map(({ media, caption }) => ({
        src: media.full.src,
        width: media.full.width,
        height: media.full.height,
        srcSet: media.full.srcSet,
        alt: media.img.alt,
        description: caption,
      }))}
      styles={{ container: { backgroundColor: 'rgba(0, 0, 0, 0.94)' } }}
    />
  );
}
