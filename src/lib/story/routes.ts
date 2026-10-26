import type { SectionOf } from './schema';

type Stops = SectionOf<'map-journey' | 'walk-line'>['stops'];

/** 경로에 영향을 주는 값(좌표·이동 수단·사진)만으로 만든 지문 */
export function stopsKey(stops: Stops): string {
  return stops.map((s) => [s.lat.toFixed(5), s.lng.toFixed(5), s.transport ?? '-', s.media ?? '-'].join(',')).join('|');
}

export type Profile = 'foot' | 'bike' | 'car' | 'straight';

/** 이동 수단 → 길찾기 프로필. 철도·항공·배는 도로 길찾기로 그리면 거짓이 되므로 점선 직선 */
export function profileFor(transport: Stops[number]['transport']): Profile {
  switch (transport) {
    case 'walk':
      return 'foot';
    case 'bike':
      return 'bike';
    case 'car':
    case 'taxi':
    case 'bus':
      return 'car';
    default:
      return 'straight';
  }
}
