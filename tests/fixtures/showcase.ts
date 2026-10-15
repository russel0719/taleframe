import { stopsKey } from '@/lib/story/routes';
import type { MediaEntry, MediaManifest, RouteData, SectionOf, Story } from '@/lib/story/schema';

/** 모든 템플릿을 한 번씩 쓰는 가짜 스토리 — 렌더·검증 테스트용. 실제 파일은 없다 */
const image = (id: string, w = 1600, h = 1200): MediaEntry => ({
  kind: 'image',
  base: `${id}-abcdef12`,
  width: w,
  height: h,
  widths: [640, 1280],
  thumbhash: 'GwgKFQJ4h3eAiHd4eIiHd4iAdwiHB3c=',
  focus: [0.5, 0.4],
});

export const manifest: MediaManifest = {
  version: 1,
  items: {
    m001: image('m001'),
    m002: image('m002', 1200, 1600),
    m003: image('m003'),
    m004: image('m004'),
    m005: image('m005'),
    m006: image('m006'),
    m007: image('m007', 8000, 4000),
    m010: {
      kind: 'video',
      base: 'm010-12345678',
      width: 1920,
      height: 1080,
      widths: [640, 1280, 1920],
      thumbhash: 'GwgKFQJ4h3eAiHd4eIiHd4iAdwiHB3c=',
      focus: [0.5, 0.5],
      duration: 12.4,
      hasAudio: true,
      mp4: true,
      scrub: true,
      ambient: true,
    },
  },
};

const s = { status: 'approved' as const };

export const showcase: Story = {
  version: 1,
  slug: 'showcase',
  status: 'published',
  title: '쇼케이스',
  summary: '모든 템플릿을 한 번씩 쓰는 테스트 스토리',
  trip: { start: '2026-02-06', end: '2026-02-09', places: ['오사카', '교토'] },
  cover: 'm001',
  media: { m001: { alt: '도시 야경' }, m010: { trim: { start: 0, end: 10 } } },
  updatedAt: '2026-10-15',
  sections: [
    { ...s, id: 'hero', template: 'hero-fullbleed', media: 'm001', title: '쇼케이스', kicker: '2026. 02', ambient: 'm010' },
    { ...s, id: 'globe', template: 'globe-intro', title: '오사카로', target: { lat: 34.69, lng: 135.5, zoom: 9 } },
    { ...s, id: 'postcard', template: 'postcard-cover', media: 'm002', title: '안녕', stamp: 'OSAKA' },
    { ...s, id: 'ch1', template: 'chapter-divider', index: '01', title: '첫째 날', media: 'm003' },
    { ...s, id: 'essay', template: 'editorial-text', heading: '글', paragraphs: ['첫 문단', '둘째 문단'], media: 'm004' },
    { ...s, id: 'quote', template: 'quote-moment', quote: '또 오자', attribution: '동행', ambient: 'none' },
    { ...s, id: 'facts', template: 'fact-card', facts: [{ label: '기간', value: '3박 4일' }, { label: '도시', value: '2곳' }] },
    { ...s, id: 'weather', template: 'weather-card', date: '2026-02-07', place: { name: '교토', lat: 35.0, lng: 135.77 } },
    { ...s, id: 'single', template: 'photo-single', media: 'm002', caption: '한 장' },
    { ...s, id: 'overlay', template: 'photo-overlay', media: 'm003', caption: '덮인 자막' },
    {
      ...s,
      id: 'gallery',
      template: 'photo-gallery',
      layout: 'masonry',
      items: [{ media: 'm001' }, { media: 'm002' }, { media: 'm003' }],
    },
    { ...s, id: 'strip', template: 'photo-strip', items: [{ media: 'm004' }, { media: 'm005', caption: '띠' }, { media: 'm006' }] },
    { ...s, id: 'polaroid', template: 'polaroid-collage', items: [{ media: 'm001', caption: '하나' }, { media: 'm002' }] },
    { ...s, id: 'compare', template: 'before-after', before: { media: 'm003', label: '낮' }, after: { media: 'm004', label: '밤' } },
    { ...s, id: 'split', template: 'split-feature', media: 'm005', heading: '장소', body: '설명', side: 'right' },
    { ...s, id: 'pano', template: 'panorama', media: 'm007', caption: '360' },
    { ...s, id: 'video', template: 'video-cinematic', media: 'm010', caption: '영상' },
    { ...s, id: 'quiet', template: 'photo-single', media: 'm006' },
    { ...s, id: 'scrub', template: 'scroll-scrub', media: 'm010', steps: [{ text: '하나' }, { text: '둘' }] },
    { ...s, id: 'pause', template: 'fact-card', facts: [{ label: 'a', value: 'b' }, { label: 'c', value: 'd' }] },
    {
      ...s,
      id: 'sticky',
      template: 'sticky-story',
      steps: [
        { media: 'm001', text: '첫 단계' },
        { media: 'm003', heading: '둘', text: '둘째 단계' },
      ],
    },
    { ...s, id: 'gap', template: 'quote-moment', quote: '쉼' },
    {
      ...s,
      id: 'map',
      template: 'map-journey',
      stops: [
        { name: '난바', lat: 34.666, lng: 135.501 },
        { name: '교토역', lat: 34.985, lng: 135.758, transport: 'train', media: 'm004' },
      ],
    },
    { ...s, id: 'place', template: 'place-feature', media: 'm005', name: '후시미 이나리', description: '설명', gallery: ['m006'] },
    { ...s, id: 'food', template: 'food-review', items: [{ media: 'm006', dish: '스시', restaurant: '가게', price: '¥2,000' }] },
    { ...s, id: 'reco', template: 'recommendation', pros: ['좋다'], tips: ['일찍 가라'] },
    {
      ...s,
      id: 'day',
      template: 'daily-timeline',
      day: 'Day 2',
      entries: [
        { time: '09:00', title: '출발' },
        { time: '12:00', title: '점심', media: 'm006' },
      ],
    },
    { ...s, id: 'stats', template: 'travel-stats', stats: [{ label: '일', value: 4 }, { label: '걸음', value: 61234 }] },
    { ...s, id: 'end', template: 'closing', media: 'm001', line: '끝', credit: '2026. 02' },
  ],
};

const mapSection = showcase.sections.find((x) => x.template === 'map-journey') as SectionOf<'map-journey'>;

export const routes: Record<string, RouteData> = {
  map: {
    key: stopsKey(mapSection.stops),
    source: 'osrm-fossgis',
    legs: [
      {
        mode: 'straight',
        coords: [
          [135.501, 34.666],
          [135.758, 34.985],
        ],
        meters: 42000,
        via: 0,
      },
    ],
  },
};
