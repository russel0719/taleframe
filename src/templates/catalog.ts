import type { MediaId, Section, TemplateId } from '@/lib/story/schema';

/**
 * 템플릿 카탈로그 — 스킬이 템플릿을 고를 때 읽는 유일한 출처.
 * `npm run tf -- catalog` 가 이 파일을 마크다운으로 출력한다. SKILL.md 에 같은 내용을 다시 적지 않는다.
 */
export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  category: 'hero' | 'text' | 'gallery' | 'video' | 'place' | 'food' | 'timeline' | 'reflection' | 'art';
  description: string;
  suitableFor: string[];
  /** 고르면 안 되는 경우 */
  avoidWhen?: string[];
  motionLevel: 'none' | 'subtle' | 'cinematic';
  /** 기본 배경 톤 (섹션의 tone 으로 덮어쓸 수 있다) */
  defaultTone: 'light' | 'parchment' | 'dark';
  /** 화면 하나를 넘게 차지하는 스크롤 장면인지 — 연달아 두면 지친다 */
  tall?: boolean;
  /** 강한 연출. 한 스토리에 몇 번, 어디에 둘지 composition.md 의 "작품 섹션" 규칙을 따른다 */
  art?: boolean;
};

export const catalog: Record<TemplateId, TemplateDefinition> = {
  'hero-fullbleed': {
    id: 'hero-fullbleed',
    name: 'Full-Bleed Hero',
    category: 'hero',
    description: '화면을 가득 채운 사진/영상 위 큰 제목. 스크롤하면 미디어가 천천히 멀어진다.',
    suitableFor: ['오프닝', '여행 분위기를 한 장으로 말하는 대표 컷'],
    avoidWhen: ['피사체가 화면 가운데 작게 있는 사진 (제목이 가린다)'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
  },
  'globe-intro': {
    id: 'globe-intro',
    name: 'Globe Intro',
    category: 'hero',
    description: '지구본이 돌다가 목적지로 내려간다. 사진 없이 "어디로 떠났는지"를 연다.',
    suitableFor: ['해외여행 오프닝', '여러 도시를 도는 여행의 첫 장면'],
    avoidWhen: ['국내 근거리 여행 (지구본이 과하다)'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
  },
  'postcard-cover': {
    id: 'postcard-cover',
    name: 'Postcard Cover',
    category: 'hero',
    description: '살짝 기운 엽서 한 장과 우표 같은 날짜 도장. 가볍고 다정한 오프닝.',
    suitableFor: ['유쾌한 톤', '짧은 여행', '친구/가족에게 보내는 느낌'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
  },
  'chapter-divider': {
    id: 'chapter-divider',
    name: 'Chapter Divider',
    category: 'text',
    description: '챕터 번호와 제목. 배경 사진을 주면 어둡게 깔린다.',
    suitableFor: ['날짜/도시가 바뀌는 지점', '이야기의 국면 전환'],
    avoidWhen: ['챕터가 2개 이하인 짧은 스토리'],
    motionLevel: 'subtle',
    defaultTone: 'dark',
  },
  'editorial-text': {
    id: 'editorial-text',
    name: 'Editorial Text',
    category: 'text',
    description: '넓은 여백의 짧은 글. 작은 사진 한 장을 곁들일 수 있다.',
    suitableFor: ['사용자가 직접 쓴 감상', '여행의 배경 설명'],
    avoidWhen: ['사용자에게 받은 문장이 없을 때 (AI 가 지어낸 에세이는 금지)'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'quote-moment': {
    id: 'quote-moment',
    name: 'Quote Moment',
    category: 'reflection',
    description: '큰 인용문 한 줄. 여행 중 들은 말, 스스로 남긴 메모.',
    suitableFor: ['기억에 남는 한마디', '챕터 끝의 여운'],
    avoidWhen: ['사용자가 말하지 않은 문장'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
  },
  'fact-card': {
    id: 'fact-card',
    name: 'Fact Card',
    category: 'text',
    description: '라벨-값 쌍의 사실 정보 (기간, 이동 수단, 숙소 지역 등).',
    suitableFor: ['여행 개요', '실용 정보'],
    avoidWhen: ['확인되지 않은 값이 섞일 때'],
    motionLevel: 'none',
    defaultTone: 'parchment',
  },
  'weather-card': {
    id: 'weather-card',
    name: 'Weather of the Day',
    category: 'text',
    description: 'Open-Meteo 과거 기록으로 그날의 실제 날씨(최고/최저 기온, 강수)를 보여준다.',
    suitableFor: ['날씨가 기억에 남은 날 (폭설, 폭염, 비)', '하루 챕터의 첫머리'],
    avoidWhen: ['날짜나 장소가 확실하지 않을 때'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'photo-single': {
    id: 'photo-single',
    name: 'Minimal Caption',
    category: 'gallery',
    description: '사진 한 장과 아래 한 줄 자막. 세로 사진이면 좁게, 가로면 넓게.',
    suitableFor: ['조용한 장면', '자막이 짧은 컷', '장면 사이 숨 고르기'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'photo-overlay': {
    id: 'photo-overlay',
    name: 'Overlay Caption',
    category: 'gallery',
    description: '화면 폭 사진 하단에 자막이 얹힌다.',
    suitableFor: ['풍경', '하이라이트 한 컷'],
    avoidWhen: ['하단에 피사체가 있는 사진'],
    motionLevel: 'subtle',
    defaultTone: 'dark',
  },
  'photo-gallery': {
    id: 'photo-gallery',
    name: 'Gallery',
    category: 'gallery',
    description: 'rows(행 맞춤) / masonry(벽돌) / columns(열) 배열. 누르면 전체 화면으로 확대.',
    suitableFor: ['같은 장소의 여러 컷', '하루의 스냅 묶음'],
    avoidWhen: ['사진마다 자막이 꼭 필요할 때 (photo-strip 이 낫다)'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'photo-strip': {
    id: 'photo-strip',
    name: 'Photo Strip',
    category: 'gallery',
    description: '손가락으로 넘기는 가로 사진 띠. 사진마다 짧은 자막.',
    suitableFor: ['걸으며 본 것들', '순서가 있는 스냅'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
  },
  'polaroid-collage': {
    id: 'polaroid-collage',
    name: 'Polaroid Collage',
    category: 'gallery',
    description: '삐뚤게 놓인 폴라로이드 묶음. 스크롤하면 하나씩 떨어진다.',
    suitableFor: ['유쾌한 순간', '사람/일행 사진', '스크랩북 느낌'],
    avoidWhen: ['차분하고 시네마틱한 톤의 스토리'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
  },
  'before-after': {
    id: 'before-after',
    name: 'Before / After',
    category: 'gallery',
    description: '같은 구도의 두 장면을 슬라이더로 비교.',
    suitableFor: ['낮과 밤', '같은 장소의 다른 날씨'],
    avoidWhen: ['구도가 다른 두 사진 (비교가 안 된다)'],
    motionLevel: 'none',
    defaultTone: 'dark',
  },
  'split-feature': {
    id: 'split-feature',
    name: 'Split Feature',
    category: 'place',
    description: '한쪽 사진, 한쪽 글. side 로 좌우를 번갈아 쓸 수 있다.',
    suitableFor: ['장소 하나에 대한 짧은 이야기', '경험 소개'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  panorama: {
    id: 'panorama',
    name: 'Panorama 360°',
    category: 'place',
    description: '드래그로 둘러보는 360° 파노라마 (equirectangular 2:1 사진 전용).',
    suitableFor: ['정상, 광장 같은 탁 트인 곳'],
    avoidWhen: ['일반 가로 사진 (왜곡된다) — 가로 파노라마는 photo-single size=full'],
    motionLevel: 'none',
    defaultTone: 'dark',
  },
  'video-cinematic': {
    id: 'video-cinematic',
    name: 'Cinematic Video',
    category: 'video',
    description: '화면 폭 영상. 보이면 무음 재생, 버튼으로 소리 켜기.',
    suitableFor: ['움직임이 핵심인 장면', '현장 소리가 좋은 클립'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
  },
  'scroll-scrub': {
    id: 'scroll-scrub',
    name: 'Scroll-Scrub Video',
    category: 'video',
    description: '스크롤에 따라 영상이 앞뒤로 재생되고 문장이 차례로 떠오른다 (Apple 제품 페이지 방식).',
    suitableFor: ['카메라가 한 방향으로 움직이는 클립 (걷기, 차창, 패닝)'],
    avoidWhen: ['컷이 여러 번 바뀌는 영상', '30초 넘는 영상 (trim 으로 자를 것)'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
    tall: true,
  },
  'sticky-story': {
    id: 'sticky-story',
    name: 'Sticky Story Scene',
    category: 'video',
    description: '사진이 화면에 고정된 채 문장이 한 단계씩 넘어가고, 단계마다 사진이 천천히 바뀐다.',
    suitableFor: ['한 장소에서의 시간 흐름', '하이라이트 경험을 단계별로'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
    tall: true,
  },
  'map-journey': {
    id: 'map-journey',
    name: 'Map Journey',
    category: 'place',
    description: '지도가 고정되고, 스크롤할 때마다 다음 장소로 날아가며 실제 길을 따라 경로가 그려진다 (tf routes, 장소별 transport 필요).',
    suitableFor: ['여러 장소를 잇는 하루', '도시 간 이동'],
    avoidWhen: ['장소가 1곳뿐', '좌표가 숙소/집처럼 공개하면 안 되는 곳'],
    motionLevel: 'cinematic',
    defaultTone: 'light',
    tall: true,
  },
  'place-feature': {
    id: 'place-feature',
    name: 'Place Feature',
    category: 'place',
    description: '장소 대표 사진 + 이름 + 설명 + 작은 썸네일 몇 장.',
    suitableFor: ['여행의 핵심 장소', '다시 가고 싶은 곳'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'food-review': {
    id: 'food-review',
    name: 'Food Review',
    category: 'food',
    description: '음식 사진 + 메뉴명 + 가게 + 한 줄 감상 + 가격(선택). 최대 4개.',
    suitableFor: ['미식 여행', '기억에 남는 한 끼'],
    avoidWhen: ['가게 이름/가격을 사용자가 확인하지 않았을 때 (해당 필드는 비운다)'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
  },
  recommendation: {
    id: 'recommendation',
    name: 'Recommendation',
    category: 'food',
    description: '좋았던 점 / 아쉬운 점 / 다음 여행자에게 팁.',
    suitableFor: ['스토리 후반', '실용 정보를 원하는 공개 독자'],
    motionLevel: 'none',
    defaultTone: 'light',
  },
  'daily-timeline': {
    id: 'daily-timeline',
    name: 'Daily Timeline',
    category: 'timeline',
    description: '시간 순서의 하루 기록. 항목마다 작은 사진.',
    suitableFor: ['일정이 빽빽했던 하루', '이동이 많은 날'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'travel-stats': {
    id: 'travel-stats',
    name: 'Travel Stats',
    category: 'reflection',
    description: '숫자가 올라가는 통계 (일수, 도시 수, 걸음 수 등).',
    suitableFor: ['에필로그 직전'],
    avoidWhen: ['사용자가 확인하지 않은 숫자'],
    motionLevel: 'subtle',
    defaultTone: 'dark',
  },
  verse: {
    id: 'verse',
    name: 'Verse (세로쓰기 시)',
    category: 'art',
    description: '한지 같은 여백 위에 세로로 쓴 시. 스크롤하면 한 줄씩 먹이 번지듯 나타나고, 옆에 사진 한 장이 족자처럼 걸린다.',
    suitableFor: ['장 사이의 숨 고르기', '신사·정원·눈처럼 고요한 장면', '사용자가 남긴 짧은 메모'],
    avoidWhen: ['줄마다 24자를 넘는 긴 문장', '사실 정보 전달 (그건 fact-card)'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
    tall: true,
    art: true,
  },
  'color-field': {
    id: 'color-field',
    name: 'Color Field (색면)',
    category: 'art',
    description: '사진마다 대표색으로 화면 전체가 물들고, 사진은 그 색면 위에 떠 있다. 색 견본처럼 색 코드가 붙는다.',
    suitableFor: ['색이 강한 사진 묶음 (주홍·말차·네온)', '"그 도시의 색"이라는 주제'],
    avoidWhen: ['색이 비슷한 사진만 있을 때 (변화가 안 느껴진다)', '어둡고 탁한 사진'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
    tall: true,
    art: true,
  },
  'film-roll': {
    id: 'film-roll',
    name: 'Film Roll (필름)',
    category: 'art',
    description: '35mm 필름 띠가 스크롤에 따라 가로로 흐른다. 가장자리에 프레임 번호와 촬영 시각이 인화된다.',
    suitableFor: ['하룻밤·한나절의 연속된 스냅 4~12장', '시간 흐름이 있는 거리 사진'],
    avoidWhen: ['한 장 한 장 자세히 봐야 하는 사진'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
    tall: true,
    art: true,
  },
  diptych: {
    id: 'diptych',
    name: 'Exhibition (전시 벽)',
    category: 'art',
    description: '미술관 벽에 매트와 액자로 건 2~3점. 작품마다 제목·메모가 적힌 캡션 카드가 붙는다.',
    suitableFor: ['구도가 좋은 사진 2~3장을 나란히', '같은 날 다른 장소의 대비'],
    avoidWhen: ['제목을 붙일 수 없는 사진 (title 필수)'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
    art: true,
  },
  spotlight: {
    id: 'spotlight',
    name: 'Spotlight (어둠 속 빛)',
    category: 'art',
    description: '어둠 속에서 손전등처럼 빛이 비추는 곳만 보이다가(데스크톱은 마우스, 모바일은 스크롤), 끝에서 전부 드러난다.',
    suitableFor: ['밤 장면, 네온, 등불', '숨은 디테일이 많은 사진'],
    avoidWhen: ['낮 풍경 (어둠이 어색하다)', '연달아 두 번'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
    tall: true,
    art: true,
  },
  'riso-print': {
    id: 'riso-print',
    name: 'Riso Print (리소 인쇄)',
    category: 'art',
    description: '두 가지 잉크로 찍은 리소그래프 포스터처럼. 망점, 살짝 어긋난 판, 큰 제목. 누르면 원본 색으로 본다.',
    suitableFor: ['형태가 뚜렷한 사진 (간판, 건물, 음식 한 그릇)', '유쾌하거나 진(zine) 같은 톤'],
    avoidWhen: ['사람 얼굴이 크게 나온 사진', '디테일이 핵심인 풍경'],
    motionLevel: 'subtle',
    defaultTone: 'light',
    art: true,
  },
  'kinetic-type': {
    id: 'kinetic-type',
    name: 'Kinetic Type (글자 속으로)',
    category: 'art',
    description: '화면을 채운 거대한 글자 안에 사진이 차 있다가, 스크롤하면 글자 속으로 빨려 들어가며 사진이 펼쳐진다.',
    suitableFor: ['챕터 시작 (도시 이름 한 단어)', '여행의 핵심어 하나'],
    avoidWhen: ['6자를 넘는 말 (글자가 작아져 효과가 죽는다)'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
    tall: true,
    art: true,
  },
  'stamp-rally': {
    id: 'stamp-rally',
    name: 'Stamp Rally (스탬프 카드)',
    category: 'food',
    description: '스탬프 카드에 들른 집마다 붉은 도장이 하나씩 찍힌다. 도장을 누르면 그 집 사진. 이름을 모르는 집은 빈 도장(?)으로 남는다.',
    suitableFor: ['같은 종류의 가게를 여러 곳 돈 여행 (우동·라멘·카페 순례)', '하루의 먹거리 기록'],
    avoidWhen: ['2곳 이하', '가게 이름을 사용자가 말해 주지 않았는데 이름을 채우려 할 때 (빈 도장으로 둔다)'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
  },
  'transit-ticket': {
    id: 'transit-ticket',
    name: 'Transit Ticket (승차권)',
    category: 'place',
    description: '출발·도착·시각이 찍힌 표 한 장. 스크롤하면 절취선에서 찢기고 아래로 창밖 사진이 이어진다.',
    suitableFor: ['이동 자체가 기억에 남은 구간 (페리, 야간열차, 비행)', '챕터 사이의 이동'],
    avoidWhen: ['출발지·도착지를 확인하지 못했을 때', '시각을 모르는데 채우려 할 때 (시각은 빼도 된다)'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'day-clock': {
    id: 'day-clock',
    name: 'Day Clock (하루 시계)',
    category: 'timeline',
    description: '24시간 원형 시계. 스크롤하면 바늘이 돌며 촬영 시각 자리의 사진이 차례로 떠오르고, 배경이 그날 해의 높이에 맞춰 새벽·낮·노을·밤으로 바뀐다.',
    suitableFor: ['이른 아침부터 밤까지 이어진 하루', '시간대별 빛이 다른 사진 묶음'],
    avoidWhen: ['촬영 시각이 없는 사진', '사진이 한두 시간 안에 몰려 있을 때 (시계가 거의 안 돈다)'],
    motionLevel: 'cinematic',
    defaultTone: 'dark',
    tall: true,
  },
  'contact-sheet': {
    id: 'contact-sheet',
    name: 'Contact Sheet (밀착 인화지)',
    category: 'gallery',
    description: '한 장면에서 연달아 찍은 컷이 밀착 인화지처럼 깔리고, 고른 컷에 붉은 색연필 동그라미가 그려진다. 누르면 크게 본다.',
    suitableFor: ['같은 자리에서 여러 장 찍은 장면 (정원, 전망, 미술관 앞)', '"고르는 과정"이 이야기가 될 때'],
    avoidWhen: ['서로 다른 장소의 사진 묶음 (photo-gallery 가 낫다)'],
    motionLevel: 'subtle',
    defaultTone: 'dark',
  },
  'photo-map': {
    id: 'photo-map',
    name: 'Photo Map (사진 지도)',
    category: 'place',
    description: '사진이 찍힌 자리에 작은 썸네일이 흩어진 지도. 경로가 아니라 어디서 많이 찍었는지를 보여준다. 좌표는 소수점 3자리(약 100m)까지만.',
    suitableFor: ['섬·동네 하나를 하루 돌아다닌 날', '사진이 넓게 흩어진 여행'],
    avoidWhen: ['숙소·집 근처 사진 (검증이 막는다)', '한 장소에서 찍은 사진만 있을 때'],
    motionLevel: 'subtle',
    defaultTone: 'light',
  },
  'palette-diary': {
    id: 'palette-diary',
    name: 'Palette Diary (색의 일기)',
    category: 'art',
    description: '하루를 촬영 순서대로 색 줄무늬 띠로 바꾼다. 사진마다 대표색이 한 줄이 되어 아침의 파랑에서 저녁의 주황으로 흘러간다. 줄을 누르면 그 사진.',
    suitableFor: ['에필로그 (날마다 한 줄)', '"그 여행의 색"'],
    avoidWhen: ['하루 사진이 3장 미만', '촬영 시각이 없는 사진'],
    motionLevel: 'subtle',
    defaultTone: 'parchment',
    art: true,
  },
  closing: {
    id: 'closing',
    name: 'Closing',
    category: 'reflection',
    description: '마지막 사진과 마무리 한 문장.',
    suitableFor: ['에필로그'],
    motionLevel: 'subtle',
    defaultTone: 'dark',
  },
};

export type MediaRef = { id: MediaId; kind: 'image' | 'video' | 'any'; path: string };

/** 섹션이 참조하는 모든 미디어와 요구 종류 — 검증과 파생 파일 생성이 공유한다 */
export function mediaRefs(s: Section): MediaRef[] {
  const refs: MediaRef[] = [];
  const add = (id: MediaId | undefined, kind: MediaRef['kind'], path: string) => {
    if (id) refs.push({ id, kind, path });
  };
  switch (s.template) {
    case 'hero-fullbleed':
      add(s.media, 'any', 'media');
      break;
    case 'video-cinematic':
    case 'scroll-scrub':
      add(s.media, 'video', 'media');
      break;
    case 'postcard-cover':
    case 'photo-single':
    case 'photo-overlay':
    case 'split-feature':
    case 'panorama':
      add(s.media, 'image', 'media');
      break;
    case 'chapter-divider':
    case 'editorial-text':
    case 'quote-moment':
    case 'closing':
      add(s.media, 'image', 'media');
      break;
    case 'photo-gallery':
    case 'photo-strip':
    case 'polaroid-collage':
      s.items.forEach((it, i) => add(it.media, 'image', `items[${i}].media`));
      break;
    case 'before-after':
      add(s.before.media, 'image', 'before.media');
      add(s.after.media, 'image', 'after.media');
      break;
    case 'sticky-story':
      s.steps.forEach((st, i) => add(st.media, 'image', `steps[${i}].media`));
      break;
    case 'map-journey':
      s.stops.forEach((st, i) => add(st.media, 'image', `stops[${i}].media`));
      break;
    case 'place-feature':
      add(s.media, 'image', 'media');
      s.gallery?.forEach((id, i) => add(id, 'image', `gallery[${i}]`));
      break;
    case 'photo-map':
      s.points.forEach((p, i) => add(p.media, 'image', `points[${i}].media`));
      break;
    case 'transit-ticket':
    case 'day-clock':
      s.items?.forEach((it, i) => add(it.media, 'image', `items[${i}].media`));
      break;
    case 'stamp-rally':
      s.stamps.forEach((st, i) => add(st.media, 'image', `stamps[${i}].media`));
      break;
    case 'contact-sheet':
      s.frames.forEach((f, i) => add(f.media, 'image', `frames[${i}].media`));
      break;
    case 'palette-diary':
      s.days.forEach((d, i) => d.items.forEach((id, j) => add(id, 'image', `days[${i}].items[${j}]`)));
      break;
    case 'food-review':
      s.items.forEach((it, i) => add(it.media, 'image', `items[${i}].media`));
      break;
    case 'daily-timeline':
      s.entries.forEach((e, i) => add(e.media, 'image', `entries[${i}].media`));
      break;
    case 'verse':
    case 'spotlight':
    case 'riso-print':
    case 'kinetic-type':
      add('media' in s ? s.media : undefined, 'image', 'media');
      break;
    case 'color-field':
    case 'film-roll':
      s.items.forEach((it, i) => add(it.media, 'image', `items[${i}].media`));
      break;
    case 'diptych':
      s.works.forEach((w, i) => add(w.media, 'image', `works[${i}].media`));
      break;
    case 'globe-intro':
    case 'fact-card':
    case 'weather-card':
    case 'recommendation':
    case 'travel-stats':
      break;
  }
  if (s.ambient && s.ambient !== 'none') add(s.ambient, 'video', 'ambient');
  return refs;
}

/** 파생 파일 생성 시 미디어가 어떤 용도로 쓰이는지 */
export type MediaUsage = { panorama: boolean; scrub: boolean; ambient: boolean; regular: boolean };

export function collectUsage(sections: Section[]): Map<MediaId, MediaUsage> {
  const usage = new Map<MediaId, MediaUsage>();
  const get = (id: MediaId) => {
    let u = usage.get(id);
    if (!u) usage.set(id, (u = { panorama: false, scrub: false, ambient: false, regular: false }));
    return u;
  };
  for (const s of sections) {
    for (const r of mediaRefs(s)) {
      const u = get(r.id);
      if (r.path === 'ambient') u.ambient = true;
      else if (s.template === 'panorama') u.panorama = true;
      else if (s.template === 'scroll-scrub') u.scrub = true;
      else u.regular = true;
    }
  }
  return usage;
}
