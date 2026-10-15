import { z } from 'zod';

/**
 * story.json 의 스키마. Claude(travel-story 스킬)가 쓰고, 렌더러가 읽는다.
 * 모든 객체는 strict — 오타 난 필드가 조용히 무시되지 않고 검증에서 걸리게 한다.
 *
 * 미디어 파일 자체(크기·파생 파일·thumbhash)는 여기 없다. `tf media` 가 만드는 media.json 에 있다.
 */

export const MediaId = z.string().regex(/^m\d{3,4}$/, '미디어 id 는 m001 형식');
export type MediaId = z.infer<typeof MediaId>;

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case');
const IsoDate = z.iso.date();
const Text = (max: number) => z.string().trim().min(1).max(max);
const Lat = z.number().min(-90).max(90);
const Lng = z.number().min(-180).max(180);

export const Tone = z.enum(['light', 'parchment', 'dark']);
export const SectionStatus = z.enum(['draft', 'needs_review', 'approved']);
export const Transport = z.enum(['walk', 'train', 'subway', 'bus', 'car', 'taxi', 'plane', 'ferry', 'bike']);

/** 모든 섹션 공통 필드 */
const base = {
  id: Slug,
  tone: Tone.optional(),
  status: SectionStatus,
  /** true 면 스킬이 이후 수정에서 이 섹션을 건드리지 않는다 */
  locked: z.boolean().optional(),
  /** 이 섹션이 화면에 있을 때 깔리는 현장음. 'none' 이면 앞에서 이어지던 소리를 끈다 */
  ambient: z.union([MediaId, z.literal('none')]).optional(),
  /** 작성 메모. 렌더링되지 않는다 */
  memo: z.string().optional(),
};

const Fact = z.strictObject({ label: Text(20), value: Text(60) });
const Item = z.strictObject({ media: MediaId, caption: Text(80).optional() });
const Point = z.strictObject({ lat: Lat, lng: Lng, zoom: z.number().min(1).max(18).optional() });
const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, '#rrggbb');

export const sectionSchemas = {
  // ── A. 오프닝 ──────────────────────────────────────────────
  'hero-fullbleed': z.strictObject({
    ...base,
    template: z.literal('hero-fullbleed'),
    media: MediaId,
    title: Text(40),
    subtitle: Text(80).optional(),
    kicker: Text(40).optional(),
    align: z.enum(['center', 'bottom']).optional(),
  }),
  'globe-intro': z.strictObject({
    ...base,
    template: z.literal('globe-intro'),
    title: Text(40),
    subtitle: Text(80).optional(),
    kicker: Text(40).optional(),
    target: Point,
  }),
  'postcard-cover': z.strictObject({
    ...base,
    template: z.literal('postcard-cover'),
    media: MediaId,
    title: Text(40),
    subtitle: Text(80).optional(),
    stamp: Text(24).optional(),
  }),

  // ── B. 텍스트 ──────────────────────────────────────────────
  'chapter-divider': z.strictObject({
    ...base,
    template: z.literal('chapter-divider'),
    index: Text(6).optional(),
    title: Text(40),
    subtitle: Text(80).optional(),
    media: MediaId.optional(),
  }),
  'editorial-text': z.strictObject({
    ...base,
    template: z.literal('editorial-text'),
    heading: Text(40).optional(),
    paragraphs: z.array(Text(400)).min(1).max(5),
    media: MediaId.optional(),
    mediaSide: z.enum(['left', 'right']).optional(),
  }),
  'quote-moment': z.strictObject({
    ...base,
    template: z.literal('quote-moment'),
    quote: Text(140),
    attribution: Text(40).optional(),
    media: MediaId.optional(),
  }),
  'fact-card': z.strictObject({
    ...base,
    template: z.literal('fact-card'),
    heading: Text(40).optional(),
    facts: z.array(Fact).min(2).max(8),
  }),
  'weather-card': z.strictObject({
    ...base,
    template: z.literal('weather-card'),
    heading: Text(40).optional(),
    date: IsoDate,
    place: z.strictObject({ name: Text(30), lat: Lat, lng: Lng }),
    note: Text(80).optional(),
  }),

  // ── C. 사진 ────────────────────────────────────────────────
  'photo-single': z.strictObject({
    ...base,
    template: z.literal('photo-single'),
    media: MediaId,
    caption: Text(80).optional(),
    place: Text(40).optional(),
    size: z.enum(['narrow', 'wide', 'full']).optional(),
  }),
  'photo-overlay': z.strictObject({
    ...base,
    template: z.literal('photo-overlay'),
    media: MediaId,
    caption: Text(80),
    place: Text(40).optional(),
  }),
  'photo-gallery': z.strictObject({
    ...base,
    template: z.literal('photo-gallery'),
    layout: z.enum(['rows', 'masonry', 'columns']),
    heading: Text(40).optional(),
    caption: Text(120).optional(),
    items: z.array(Item).min(3).max(24),
  }),
  'photo-strip': z.strictObject({
    ...base,
    template: z.literal('photo-strip'),
    heading: Text(40).optional(),
    items: z.array(Item).min(3).max(15),
  }),
  'polaroid-collage': z.strictObject({
    ...base,
    template: z.literal('polaroid-collage'),
    heading: Text(40).optional(),
    items: z.array(Item).min(2).max(6),
  }),
  'before-after': z.strictObject({
    ...base,
    template: z.literal('before-after'),
    before: z.strictObject({ media: MediaId, label: Text(20).optional() }),
    after: z.strictObject({ media: MediaId, label: Text(20).optional() }),
    caption: Text(80).optional(),
  }),
  'split-feature': z.strictObject({
    ...base,
    template: z.literal('split-feature'),
    media: MediaId,
    heading: Text(40),
    body: Text(400),
    place: Text(40).optional(),
    side: z.enum(['left', 'right']).optional(),
  }),
  panorama: z.strictObject({
    ...base,
    template: z.literal('panorama'),
    media: MediaId,
    caption: Text(80).optional(),
    place: Text(40).optional(),
  }),

  // ── D. 영상 · 스크롤 장면 ──────────────────────────────────
  'video-cinematic': z.strictObject({
    ...base,
    template: z.literal('video-cinematic'),
    media: MediaId,
    caption: Text(80).optional(),
    place: Text(40).optional(),
  }),
  'scroll-scrub': z.strictObject({
    ...base,
    template: z.literal('scroll-scrub'),
    media: MediaId,
    steps: z.array(z.strictObject({ text: Text(80) })).min(1).max(5),
  }),
  'sticky-story': z.strictObject({
    ...base,
    template: z.literal('sticky-story'),
    steps: z
      .array(z.strictObject({ media: MediaId, heading: Text(40).optional(), text: Text(160) }))
      .min(2)
      .max(6),
  }),

  // ── E. 장소 · 이동 ─────────────────────────────────────────
  'map-journey': z.strictObject({
    ...base,
    template: z.literal('map-journey'),
    heading: Text(40).optional(),
    stops: z
      .array(
        z.strictObject({
          name: Text(30),
          lat: Lat,
          lng: Lng,
          /** 이전 장소에서 여기로 온 방법 */
          transport: Transport.optional(),
          media: MediaId.optional(),
          note: Text(120).optional(),
        }),
      )
      .min(2)
      .max(12),
  }),
  'place-feature': z.strictObject({
    ...base,
    template: z.literal('place-feature'),
    media: MediaId,
    name: Text(30),
    description: Text(400),
    facts: z.array(Fact).max(4).optional(),
    gallery: z.array(MediaId).max(4).optional(),
  }),

  // ── F. 음식 · 경험 ─────────────────────────────────────────
  'food-review': z.strictObject({
    ...base,
    template: z.literal('food-review'),
    heading: Text(40).optional(),
    items: z
      .array(
        z.strictObject({
          media: MediaId,
          dish: Text(30),
          restaurant: Text(40).optional(),
          note: Text(160).optional(),
          price: Text(20).optional(),
        }),
      )
      .min(1)
      .max(4),
  }),
  recommendation: z
    .strictObject({
      ...base,
      template: z.literal('recommendation'),
      heading: Text(40).optional(),
      pros: z.array(Text(100)).max(6).optional(),
      cons: z.array(Text(100)).max(6).optional(),
      tips: z.array(Text(120)).max(6).optional(),
    })
    .refine((s) => (s.pros?.length ?? 0) + (s.cons?.length ?? 0) + (s.tips?.length ?? 0) > 0, {
      message: 'pros / cons / tips 중 하나는 있어야 한다',
    }),

  // ── G. 시간 · 회고 ─────────────────────────────────────────
  'daily-timeline': z.strictObject({
    ...base,
    template: z.literal('daily-timeline'),
    day: Text(20).optional(),
    date: IsoDate.optional(),
    entries: z
      .array(
        z.strictObject({
          time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
          title: Text(40),
          note: Text(160).optional(),
          media: MediaId.optional(),
        }),
      )
      .min(2)
      .max(12),
  }),
  'travel-stats': z.strictObject({
    ...base,
    template: z.literal('travel-stats'),
    heading: Text(40).optional(),
    stats: z.array(z.strictObject({ label: Text(20), value: z.number().nonnegative(), unit: Text(8).optional() })).min(2).max(6),
  }),
  closing: z.strictObject({
    ...base,
    template: z.literal('closing'),
    media: MediaId.optional(),
    line: Text(120),
    credit: Text(60).optional(),
  }),

  // ── H. 작품 — 기록을 넘어 한 장면을 작품처럼 ────────────────
  /** 세로쓰기 시. 스크롤에 따라 한 줄씩 먹이 번지듯 나타난다 */
  verse: z.strictObject({
    ...base,
    template: z.literal('verse'),
    lines: z.array(Text(24)).min(1).max(8),
    media: MediaId.optional(),
    attribution: Text(40).optional(),
  }),
  /** 사진마다 대표색으로 화면 전체가 물든다 (media.json 팔레트) */
  'color-field': z.strictObject({
    ...base,
    template: z.literal('color-field'),
    heading: Text(40).optional(),
    items: z.array(Item).min(2).max(5),
  }),
  /** 35mm 필름 띠가 스크롤에 따라 가로로 흘러간다. 프레임 번호와 촬영 시각 */
  'film-roll': z.strictObject({
    ...base,
    template: z.literal('film-roll'),
    heading: Text(40).optional(),
    /** 필름 가장자리에 찍히는 글자 (예: "KYOTO 2026") */
    label: z.string().regex(/^[A-Z0-9 .·-]{1,24}$/, '영문 대문자·숫자 24자 이내').optional(),
    items: z.array(Item).min(4).max(12),
  }),
  /** 전시 벽: 매트와 액자, 작품 캡션(placard) */
  diptych: z.strictObject({
    ...base,
    template: z.literal('diptych'),
    heading: Text(40).optional(),
    /** 전시 서문 */
    statement: Text(240).optional(),
    works: z
      .array(z.strictObject({ media: MediaId, title: Text(30), note: Text(80).optional() }))
      .min(2)
      .max(3),
  }),
  /** 어둠 속에서 빛이 비추는 곳만 보이다가, 끝에서 전부 드러난다 */
  spotlight: z.strictObject({
    ...base,
    template: z.literal('spotlight'),
    media: MediaId,
    caption: Text(80).optional(),
    place: Text(40).optional(),
  }),
  /** 두 가지 잉크로 찍은 리소그래프 포스터. 망점과 어긋난 판 */
  'riso-print': z.strictObject({
    ...base,
    template: z.literal('riso-print'),
    media: MediaId,
    title: Text(20).optional(),
    caption: Text(80).optional(),
    /** 잉크 두 가지. 없으면 사진 팔레트에서 고른다 */
    inks: z.tuple([Hex, Hex]).optional(),
  }),
  /** 거대한 글자 안에 사진이 차 있다가, 글자 속으로 빨려 들어가며 사진이 펼쳐진다 */
  'kinetic-type': z.strictObject({
    ...base,
    template: z.literal('kinetic-type'),
    text: Text(12),
    media: MediaId.optional(),
    caption: Text(80).optional(),
  }),
} as const;

export type TemplateId = keyof typeof sectionSchemas;
export const templateIds = Object.keys(sectionSchemas) as TemplateId[];

export const Section = z.discriminatedUnion(
  'template',
  Object.values(sectionSchemas) as unknown as [
    (typeof sectionSchemas)[TemplateId],
    ...(typeof sectionSchemas)[TemplateId][],
  ],
);
export type Section = z.infer<typeof Section>;
export type SectionOf<T extends TemplateId> = z.infer<(typeof sectionSchemas)[T]>;

/** 미디어별 표현 옵션. 파생 파일 생성(trim)과 렌더(focus/alt) 양쪽에서 쓴다 */
export const MediaOptions = z.strictObject({
  /** 화면에 보이는 내용 묘사 (자막이 아니다). 장소명은 사용자가 확인한 것만 */
  alt: Text(120).optional(),
  /** 크롭 기준점 [x, y] (0~1). 없으면 media.json 의 자동 계산값 */
  focus: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  /** 영상 구간 (초) */
  trim: z.strictObject({ start: z.number().min(0), end: z.number().positive() }).optional(),
});
export type MediaOptions = z.infer<typeof MediaOptions>;

export const Story = z.strictObject({
  $schema: z.string().optional(),
  version: z.literal(1),
  slug: Slug,
  status: z.enum(['draft', 'published']),
  title: Text(40),
  subtitle: Text(80).optional(),
  /** 목록 카드에 쓰는 한두 문장 */
  summary: Text(160),
  trip: z.strictObject({
    start: IsoDate,
    end: IsoDate.optional(),
    /** 표시용 지명 (사용자가 확인한 것) */
    places: z.array(Text(30)).min(1).max(8),
  }),
  cover: MediaId,
  /** 실험적: 여행별 무드. 디자인 방향이 정해지면 바뀔 수 있다 */
  theme: z
    .strictObject({ accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() })
    .optional(),
  media: z.record(MediaId, MediaOptions).optional(),
  sections: z.array(Section).min(1),
  updatedAt: z.iso.date(),
});
export type Story = z.infer<typeof Story>;

// ── media.json (tf media 가 생성) ───────────────────────────────

export const MediaEntry = z.strictObject({
  kind: z.enum(['image', 'video']),
  /** 파생 파일 이름의 접두사: `<id>-<hash>` */
  base: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** 실제로 만든 webp 가로폭 목록 (이미지면 원본, 영상이면 포스터) */
  widths: z.array(z.number().int().positive()).min(1),
  thumbhash: z.string(),
  focus: z.tuple([z.number(), z.number()]),
  palette: z.record(z.string(), z.string()).optional(),
  duration: z.number().optional(),
  hasAudio: z.boolean().optional(),
  /** 일반 재생용 mp4 가 있는지 */
  mp4: z.boolean().optional(),
  /** 스크럽용 전-키프레임 영상이 있는지 */
  scrub: z.boolean().optional(),
  /** 현장음 오디오(m4a)가 있는지 */
  ambient: z.boolean().optional(),
  /** 공유 카드용 1200x630 jpg 가 있는지 (cover 만) */
  og: z.boolean().optional(),
  /** 사진·포스터 파생 형식. 없으면 예전 webp. avif 면 가장 작은 폭의 webp 대체본이 하나 더 있다 */
  format: z.enum(['avif', 'webp']).optional(),
  /** 촬영 현지 시각 "YYYY-MM-DDTHH:MM" (시간대·GPS 없음) — 필름 프레임 등에 표시 */
  taken: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).optional(),
});
export type MediaEntry = z.infer<typeof MediaEntry>;

export const MediaManifest = z.strictObject({
  version: z.literal(1),
  items: z.record(MediaId, MediaEntry),
});
export type MediaManifest = z.infer<typeof MediaManifest>;

export const WeatherDay = z.strictObject({
  date: IsoDate,
  place: z.string(),
  code: z.number().int(),
  tMax: z.number(),
  tMin: z.number(),
  precipitation: z.number(),
  source: z.literal('open-meteo'),
});
export const WeatherFile = z.record(z.string(), WeatherDay);
export type WeatherDay = z.infer<typeof WeatherDay>;

// ── routes.json (tf routes 가 생성) ─────────────────────────────

/** 한 구간의 경로. straight 는 길찾기를 못 하는 수단(기차·비행기 등)이라 점선으로 그린다 */
export const RouteLeg = z.strictObject({
  mode: z.enum(['foot', 'bike', 'car', 'straight']),
  /** [lng, lat] — 소수점 5자리 */
  coords: z.array(z.tuple([z.number(), z.number()])).min(2),
  meters: z.number().nonnegative(),
  /** 경유지로 쓴 사진 촬영 지점 수 */
  via: z.number().int().nonnegative(),
});
export type RouteLeg = z.infer<typeof RouteLeg>;

export const RouteData = z.strictObject({
  /** 장소 목록이 바뀌었는지 알아보는 지문 — 다르면 경로를 다시 받아야 한다 */
  key: z.string(),
  source: z.literal('osrm-fossgis'),
  legs: z.array(RouteLeg),
});
export type RouteData = z.infer<typeof RouteData>;
export const RoutesFile = z.record(z.string(), RouteData);
