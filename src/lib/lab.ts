import type { MediaManifest, RouteData, Section, Story, WeatherDay } from './story/schema';
import { templateIds, type TemplateId } from './story/schema';

/**
 * 템플릿 실험실 — 실제 스토리의 파생 미디어로 모든 템플릿을 한 페이지에 그린다 (개발 전용 /lab).
 * 새 템플릿은 실제 화면으로 확인하기 전에는 스토리에 쓰지 않는다: `npm run shot -- lab`.
 * 문구는 전부 자리표시다. 이 페이지는 배포되지 않는다.
 */

type Pick = {
  images: string[];
  /** 일반 재생 mp4 가 있는 영상 */
  video?: string;
  /** 스크럽 영상이 있는 영상 */
  scrub?: string;
  /** 현장음이 있는 영상 */
  ambient?: string;
};

export function pickMedia(manifest: MediaManifest): Pick {
  const entries = Object.entries(manifest.items);
  return {
    images: entries.filter(([, m]) => m.kind === 'image').map(([id]) => id),
    video: entries.find(([, m]) => m.mp4)?.[0],
    scrub: entries.find(([, m]) => m.scrub)?.[0],
    ambient: entries.find(([, m]) => m.ambient)?.[0],
  };
}

const T = '실험실 예시 문장';

/** 템플릿별 예시 섹션. 필요한 미디어가 없으면 null (그 템플릿은 건너뛰고 화면에 알린다) */
export function labSection(t: TemplateId, p: Pick): Section | null {
  const img = (i: number) => p.images[i % p.images.length];
  const items = (n: number, from = 0) => Array.from({ length: n }, (_, i) => ({ media: img(from + i), caption: i % 2 ? undefined : `${T} ${i + 1}` }));
  const s = { id: `lab-${t}`, status: 'draft' as const };
  switch (t) {
    case 'hero-fullbleed':
      return { ...s, template: t, media: img(0), title: '실험실', kicker: '모든 템플릿' };
    case 'globe-intro':
      return { ...s, template: t, title: '지구본', target: { lat: 34.99, lng: 135.76, zoom: 9 } };
    case 'postcard-cover':
      return { ...s, template: t, media: img(1), title: '엽서', stamp: 'LAB' };
    case 'chapter-divider':
      return { ...s, template: t, index: '01', title: '챕터', subtitle: T, media: img(2) };
    case 'editorial-text':
      return { ...s, template: t, heading: '글', paragraphs: [T, `${T}. ${T}.`], media: img(3) };
    case 'quote-moment':
      return { ...s, template: t, quote: T, attribution: '자리표시' };
    case 'fact-card':
      return { ...s, template: t, heading: '사실', facts: [{ label: '기간', value: '3박 4일' }, { label: '도시', value: '2곳' }, { label: '이동', value: '도보' }] };
    case 'weather-card':
      return { ...s, template: t, date: '2026-02-08', place: { name: '실험실', lat: 34.9, lng: 135.7 }, note: T };
    case 'photo-single':
      return { ...s, template: t, media: img(4), caption: T, place: '장소' };
    case 'photo-overlay':
      return { ...s, template: t, media: img(5), caption: T };
    case 'photo-gallery':
      return { ...s, template: t, layout: 'masonry', heading: '갤러리', items: items(6, 6) };
    case 'photo-strip':
      return { ...s, template: t, heading: '사진 띠', items: items(5, 12) };
    case 'polaroid-collage':
      return { ...s, template: t, heading: '폴라로이드', items: items(4, 17) };
    case 'before-after':
      return { ...s, template: t, before: { media: img(21), label: '앞' }, after: { media: img(22), label: '뒤' }, caption: T };
    case 'split-feature':
      return { ...s, template: t, media: img(23), heading: '나란히', body: `${T}. ${T}.`, side: 'right' };
    case 'panorama':
      return { ...s, template: t, media: img(24), caption: '2:1 사진이 아니면 왜곡된다 (실험실 전용)' };
    case 'video-cinematic':
      return p.video ? { ...s, template: t, media: p.video, caption: T } : null;
    case 'scroll-scrub':
      return p.scrub ? { ...s, template: t, media: p.scrub, steps: [{ text: `${T} 1` }, { text: `${T} 2` }] } : null;
    case 'sticky-story':
      return { ...s, template: t, steps: [0, 1, 2].map((i) => ({ media: img(25 + i), heading: `단계 ${i + 1}`, text: T })) };
    case 'map-journey':
      return {
        ...s,
        template: t,
        heading: '지도',
        stops: [
          { name: '첫 장소', lat: 34.967, lng: 135.773, media: img(28) },
          { name: '둘째 장소', lat: 34.996, lng: 135.783, transport: 'walk' },
          { name: '셋째 장소', lat: 35.005, lng: 135.765, transport: 'train' },
        ],
      };
    case 'place-feature':
      return { ...s, template: t, media: img(29), name: '장소', description: T, facts: [{ label: '시간', value: '오전' }], gallery: [img(30), img(31)] };
    case 'food-review':
      return { ...s, template: t, heading: '음식', items: [0, 1, 2].map((i) => ({ media: img(32 + i), dish: `메뉴 ${i + 1}`, note: T })) };
    case 'recommendation':
      return { ...s, template: t, heading: '추천', pros: [T], cons: [T], tips: [T] };
    case 'daily-timeline':
      return { ...s, template: t, day: '하루', entries: [{ time: '09:00', title: '아침', media: img(35) }, { time: '12:00', title: '점심' }, { time: '18:00', title: '저녁', media: img(36) }] };
    case 'travel-stats':
      return { ...s, template: t, heading: '숫자', stats: [{ label: '일', value: 4 }, { label: '장소', value: 12 }, { label: '걸음', value: 61234 }] };
    case 'closing':
      return { ...s, template: t, media: img(37), line: T, credit: '실험실' };
    case 'verse':
      return { ...s, template: t, lines: ['붉은 문 사이로', '아침이 걸어 들어오고', '나는 그 뒤를 따랐다'], media: img(38), attribution: '자리표시' };
    case 'color-field':
      return { ...s, template: t, heading: '색면', items: items(3, 39) };
    case 'film-roll':
      return { ...s, template: t, heading: '필름', label: 'LAB 2026', items: items(6, 2) };
    case 'diptych':
      return { ...s, template: t, heading: '전시', statement: `${T}. ${T}.`, works: [0, 1, 2].map((i) => ({ media: img(8 + i), title: `작품 ${i + 1}`, note: T })) };
    case 'spotlight':
      return { ...s, template: t, media: img(5), caption: T, place: '장소' };
    case 'riso-print':
      return { ...s, template: t, media: img(11), title: 'RISO', caption: T };
    case 'kinetic-type':
      return { ...s, template: t, text: '교토', media: img(7), caption: T };
  }
}

export function buildLab(source: { story: Story; manifest: MediaManifest }): {
  story: Story;
  weather: Record<string, WeatherDay>;
  routes: Record<string, RouteData>;
  skipped: TemplateId[];
} {
  const pick = pickMedia(source.manifest);
  const sections: Section[] = [];
  const skipped: TemplateId[] = [];
  for (const t of templateIds) {
    const sec = labSection(t, pick);
    if (sec) sections.push(sec);
    else skipped.push(t);
  }
  return {
    // 미디어 URL 이 원본 스토리 폴더를 가리키도록 slug 는 그대로 쓴다
    story: { ...source.story, status: 'draft', title: '템플릿 실험실', sections, media: source.story.media },
    weather: {
      'lab-weather-card': { date: '2026-02-08', place: '실험실', code: 73, tMax: 4.2, tMin: -0.8, precipitation: 6.1, source: 'open-meteo' },
    },
    routes: {},
    skipped,
  };
}
