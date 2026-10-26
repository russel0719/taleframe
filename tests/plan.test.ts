import { describe, expect, it } from 'vitest';
import { groupMatches, matchPhoto, planTransport, type PlanItem } from '../scripts/lib/planMatch';

// 다카마쓰 실측에서 나온 경우들을 줄인 가짜 일정 (좌표는 실제 장소 근처)
const item = (o: Partial<PlanItem> & Pick<PlanItem, 'id' | 'title'>): PlanItem => ({
  day_date: '2026-10-23',
  position: 0,
  type: 'attraction',
  start_time: null,
  end_time: null,
  location_name: null,
  location_lat: null,
  location_lng: null,
  transport_mode: null,
  meal_type: null,
  notes: null,
  price: null,
  currency: null,
  ...o,
});

const UDON = item({ id: 'udon', type: 'restaurant', title: '아침 (사카에다 우동)', start_time: '07:30', end_time: '08:00', location_lat: 34.3398, location_lng: 134.0416 });
const WALK = item({ id: 'walk', type: 'transport', title: '우동 -> 리쓰린', start_time: '08:00', end_time: '08:30', location_lat: 34.3323, location_lng: 134.0432, from_location_lat: 34.3398, from_location_lng: 134.0416, transport_mode: 'walk' });
// 실제로는 오전인데 20:30 으로 잘못 적은 일정
const PARK = item({ id: 'park', title: '리쓰린 공원 산책', start_time: '20:30', end_time: '22:30', location_lat: 34.3277, location_lng: 134.0426 });
const LUNCH = item({ id: 'lunch', type: 'restaurant', title: '점심 (우에하라야)', start_time: '11:00', end_time: '11:30', location_lat: 34.3271, location_lng: 134.0454 });
const BAR = item({ id: 'bar', title: '심야 바', start_time: '23:00', end_time: '01:00', location_lat: 34.343, location_lng: 134.05 });
const DAY = [UDON, WALK, PARK, LUNCH, BAR];

describe('사진 ↔ 계획 매칭', () => {
  it('구간 안이고 장소도 맞으면 확실', () => {
    expect(matchPhoto('2026-10-23T07:40:00+09:00', [34.3399, 134.0417], DAY)).toMatchObject({ confidence: 'confident', item: 'udon' });
  });

  it('이동 일정은 출발지 근처도 그 일정이다 (도착지만 보면 어긋남으로 셌다)', () => {
    expect(matchPhoto('2026-10-23T08:02:00+09:00', [34.3397, 134.0417], DAY)).toMatchObject({ confidence: 'confident', item: 'walk' });
  });

  it('바로 다음 일정 장소에 일찍 닿은 것은 어긋남이 아니라 좌표로 확인', () => {
    // 아침 시간(07:55)인데 이미 다음 일정(08:00 이동)의 도착지 북문 앞
    expect(matchPhoto('2026-10-23T07:55:00+09:00', [34.3324, 134.0433], DAY)).toMatchObject({ confidence: 'place', item: 'walk', gapMinutes: 5 });
  });

  it('시각을 잘못 적은 일정은 어긋남으로 잡아 묻는다 (계획 20:30 인데 08:27 에 그 공원 안)', () => {
    const m = matchPhoto('2026-10-23T08:27:00+09:00', [34.3278, 134.0427], DAY);
    expect(m).toMatchObject({ confidence: 'conflict', item: 'walk', byPlace: { item: 'park' } });
  });

  it('끝이 시작보다 이른 일정은 자정을 넘긴 것이다', () => {
    expect(matchPhoto('2026-10-23T23:40:00+09:00', null, DAY)).toMatchObject({ confidence: 'confident', item: 'bar' });
  });

  it('계획에 없는 날이면 null, 근거가 없으면 day', () => {
    expect(matchPhoto('2026-10-25T09:00:00+09:00', null, DAY)).toBeNull();
    expect(matchPhoto('2026-10-23T15:00:00+09:00', null, DAY)).toMatchObject({ confidence: 'day' });
  });
});

describe('질문 묶음', () => {
  it('확실한 것은 일정 하나에 한 줄, 이어진 어긋남은 한 묶음', () => {
    const photos = [
      { id: 'a', takenAt: '2026-10-23T07:40:00+09:00', gps: [34.3399, 134.0417] },
      { id: 'b', takenAt: '2026-10-23T07:45:00+09:00', gps: [34.3399, 134.0417] },
      { id: 'c', takenAt: '2026-10-23T08:27:00+09:00', gps: [34.3278, 134.0427] },
      { id: 'd', takenAt: '2026-10-23T08:29:00+09:00', gps: [34.3277, 134.0426] },
    ] as const;
    const matches = Object.fromEntries(photos.map((p) => [p.id, matchPhoto(p.takenAt, [...p.gps], DAY)!]));
    const g = groupMatches([...photos], matches, DAY);
    expect(g.confirm).toEqual([expect.objectContaining({ item: 'udon', photos: ['a', 'b'], first: '07:40', last: '07:45', planned: '07:30–08:00' })]);
    expect(g.ask).toEqual([expect.objectContaining({ item: 'walk', photos: ['c', 'd'], byPlace: expect.objectContaining({ item: 'park' }) })]);
  });
});

describe('이동수단', () => {
  it('대중교통은 기차·버스를 구분 못 해 비워 두고(물어야 한다), 페리는 제목으로 안다', () => {
    expect(planTransport('public', '시코쿠무라로 이동')).toBeNull();
    expect(planTransport('public', '다카마쓰 -> 미야노우라 (페리)')).toBe('ferry');
    expect(planTransport('walk')).toBe('walk');
    expect(planTransport('flight')).toBe('plane');
  });
});
