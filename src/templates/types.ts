import type { RouteData, SectionOf, TemplateId, WeatherDay } from '@/lib/story/schema';

export type TemplateProps<T extends TemplateId> = {
  section: SectionOf<T>;
  /** 스토리의 첫 섹션인지 — 첫 화면 이미지는 지연 로딩하지 않고, 목록과 화면 전환을 잇는다 */
  first: boolean;
  slug: string;
  weather?: WeatherDay;
  route?: RouteData;
};
