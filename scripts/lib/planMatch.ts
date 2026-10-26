/**
 * travel-plan 의 일정 ↔ 사진 매칭 (순수 함수 — 테스트·CLI·Studio 공용).
 *
 * travel-video-maker 의 plan.py 를 옮겼다 (실제 사진으로 검증된 규칙). 핵심:
 * **시각과 좌표를 독립된 두 근거로 따로 본다.** 같은 곳을 가리키면 믿고, 어긋나면 그 자체가 물어볼 신호다.
 * 계획대로 안 간 날, 시각을 잘못 적은 일정(오전을 20:30 으로)이 실제로 있다.
 *
 *   confident  시각 구간 안 (좌표가 멀지 않음)
 *   conflict   시각은 A 인데 좌표는 B 에 훨씬 가까움 → 사용자에게 묻는다
 *   place      시각은 안 맞지만 좌표가 NEAR_METERS 안
 *   nearby     구간 밖이지만 NEAR_MINUTES 안
 *   day        같은 날이라는 것 말고 근거 없음
 */

/** travel-plan /api/export (version 1) 의 일정 한 줄 */
export type PlanItem = {
  id: string;
  day_date: string;
  position: number;
  type: 'attraction' | 'restaurant' | 'hotel' | 'transport';
  title: string;
  start_time: string | null;
  end_time: string | null;
  location_name: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address?: string | null;
  location_place_id?: string | null;
  from_location_name?: string | null;
  from_location_lat?: number | null;
  from_location_lng?: number | null;
  transport_mode: 'walk' | 'public' | 'car' | 'taxi' | 'flight' | null;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  check_type?: 'checkin' | 'checkout' | null;
  notes: string | null;
  price: number | null;
  currency: string | null;
};

export type PlanFlight = {
  id: string;
  direction: 'outbound' | 'inbound';
  airline: string;
  flight_number: string;
  departure_airport: string;
  departure_date: string;
  departure_time: string;
  arrival_airport: string;
  arrival_date: string;
  arrival_time: string;
};

export type PlanLodging = { id: string; name: string; check_in_date: string; check_out_date: string; lat: number | null; lng: number | null };

export type PlanTrip = { id: string; title: string; destination: string | null; start_date: string; end_date: string; is_international?: boolean | null };

export type PlanExport = { version: 1; trip: PlanTrip; schedule: PlanItem[]; flights: PlanFlight[]; lodging: PlanLodging[]; errors?: string[] };

export type Confidence = 'confident' | 'conflict' | 'place' | 'nearby' | 'day';

export type PlanMatch = {
  confidence: Confidence;
  day: string;
  /** 매칭된 일정 (day 이면 없음) */
  item?: string;
  title?: string;
  location?: string;
  /** 사진에서 그 일정 장소까지 거리 (m) */
  meters?: number;
  /** 시각 구간 밖이면 몇 분 떨어졌나 */
  gapMinutes?: number;
  /** 시각은 맞는데 계획 좌표에서 FAR_METERS 넘게 떨어짐 — 확인할 근거 */
  far?: boolean;
  /** conflict 일 때 좌표가 가리킨 다른 일정 */
  byPlace?: { item: string; title: string; location?: string; meters: number };
};

export const NEAR_MINUTES = 90;
/** 이 안이면 바로 앞뒤 일정이다 — 그 장소에 조금 일찍 닿았거나 늦게 떠난 것이지 어긋난 게 아니다 */
export const ADJACENT_MINUTES = 60;
export const NEAR_METERS = 400;
export const FAR_METERS = 1500;

/** "2026-10-22T07:31:05+09:00" → 그날 0시부터 분 (현지 시각 그대로). 형식이 다르면 null */
export function localMinutes(takenAt: string): { day: string; min: number } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(takenAt);
  return m ? { day: m[1], min: Number(m[2]) * 60 + Number(m[3]) } : null;
}

const hhmm = (t: string | null) => {
  const m = t ? /^(\d{1,2}):(\d{2})/.exec(t) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

/** [시작, 끝] (분). 끝이 시작보다 이르면 자정을 넘긴 일정이다 (travel-plan 규칙 — 유효한 값) */
function span(it: PlanItem): [number, number] | null {
  const s = hhmm(it.start_time);
  if (s === null) return null;
  let e = hhmm(it.end_time) ?? s;
  if (e < s) e += 24 * 60;
  return [s, e];
}

export function haversineM(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const coords = (it: PlanItem): [number, number] | null =>
  typeof it.location_lat === 'number' && typeof it.location_lng === 'number' ? [it.location_lat, it.location_lng] : null;

/** 이동 일정은 location 이 도착지다 — 출발지(from_location)도 그 일정의 장소로 본다 */
function distTo(it: PlanItem, gps: [number, number]): number | undefined {
  const pts = [coords(it), typeof it.from_location_lat === 'number' && typeof it.from_location_lng === 'number' ? ([it.from_location_lat, it.from_location_lng] as [number, number]) : null];
  const ds = pts.filter((c): c is [number, number] => !!c).map((c) => haversineM(gps, c));
  return ds.length ? Math.round(Math.min(...ds)) : undefined;
}

/** 사진 시각이 그 일정 구간에서 몇 분 떨어졌나 (구간 안이면 0, 시각이 없으면 Infinity) */
function gapTo(it: PlanItem, min: number): number {
  const sp = span(it);
  if (!sp) return Infinity;
  return min < sp[0] ? sp[0] - min : min > sp[1] ? min - sp[1] : 0;
}

function byTime(min: number, items: PlanItem[]): { it: PlanItem; how: 'in' | 'near'; gap: number } | null {
  let best: PlanItem | null = null;
  let gap = Infinity;
  for (const it of items) {
    const sp = span(it);
    if (!sp) continue;
    if (sp[0] <= min && min <= sp[1]) return { it, how: 'in', gap: 0 };
    const d = Math.min(Math.abs(min - sp[0]), Math.abs(min - sp[1]));
    if (d < gap) [best, gap] = [it, d];
  }
  return best && gap <= NEAR_MINUTES ? { it: best, how: 'near', gap: Math.round(gap) } : null;
}

function byPlace(gps: [number, number], items: PlanItem[], min: number): { it: PlanItem; meters: number } | null {
  let best: { it: PlanItem; meters: number; gap: number } | null = null;
  for (const it of items) {
    const d = distTo(it, gps);
    if (d === undefined) continue;
    // 같은 자리를 여러 일정이 쓰면(갈 때·올 때 같은 항구) 시각이 가까운 쪽
    const gap = gapTo(it, min);
    if (!best || d < best.meters - 30 || (Math.abs(d - best.meters) <= 30 && gap < best.gap)) best = { it, meters: d, gap };
  }
  return best && { it: best.it, meters: best.meters };
}

const brief = (it: PlanItem) => ({ item: it.id, title: it.title, ...(it.location_name ? { location: it.location_name } : {}) });

/** 촬영 시각(과 있으면 좌표 [lat, lng])을 그날 일정에 맞춘다. 계획에 없는 날이면 null */
export function matchPhoto(takenAt: string | null, gps: [number, number] | null, schedule: PlanItem[]): PlanMatch | null {
  const t = takenAt ? localMinutes(takenAt) : null;
  if (!t) return null;
  const sameDay = schedule.filter((i) => i.day_date.slice(0, 10) === t.day);
  if (!sameDay.length) return null;

  const ti = byTime(t.min, sameDay);
  const pi = gps ? byPlace(gps, sameDay, t.min) : null;
  const tdist = gps && ti ? distTo(ti.it, gps) : undefined;

  // 좌표가 "훨씬" 가까운 다른 일정을 가리키면 단정하지 않는다. 계획 좌표는 원래 대략적이라
  // 절대 거리 하나로 자르지 않고 두 후보의 거리를 견준다 (plan.py 와 같은 기준).
  // 단 그 다른 일정이 시각상 바로 앞뒤면 어긋난 게 아니라 일찍 닿은 것이다 — 좌표를 믿는다.
  // (다카마쓰 259장 실측: 이 구분 없이는 어긋남 74장 중 40여 장이 체크인 직후·도착 3분 전 같은 오탐이었다)
  const placeWins =
    ti && pi && ti.it.id !== pi.it.id && pi.meters <= NEAR_METERS && tdist !== undefined && tdist > NEAR_METERS && tdist >= pi.meters * 2 + 200;
  if (placeWins && gapTo(pi.it, t.min) <= ADJACENT_MINUTES) {
    return { confidence: 'place', day: t.day, ...brief(pi.it), meters: pi.meters, gapMinutes: Math.round(gapTo(pi.it, t.min)) };
  }
  if (placeWins && ti.how === 'in') {
    return { confidence: 'conflict', day: t.day, ...brief(ti.it), meters: tdist, byPlace: { ...brief(pi.it), meters: pi.meters } };
  }
  if (ti?.how === 'in') {
    return { confidence: 'confident', day: t.day, ...brief(ti.it), ...(tdist !== undefined ? { meters: tdist } : {}), ...(tdist !== undefined && tdist > FAR_METERS ? { far: true } : {}) };
  }
  if (pi && pi.meters <= NEAR_METERS) return { confidence: 'place', day: t.day, ...brief(pi.it), meters: pi.meters };
  if (ti?.how === 'near') return { confidence: 'nearby', day: t.day, ...brief(ti.it), gapMinutes: ti.gap, ...(tdist !== undefined ? { meters: tdist } : {}) };
  return { confidence: 'day', day: t.day };
}

// ── 질문용 묶음 ─────────────────────────────────────────────

export type ConfirmGroup = { day: string; item: string; title: string; location?: string; planned?: string; photos: string[]; first: string; last: string };
export type AskGroup = ConfirmGroup & { byPlace: { item: string; title: string; location?: string } };

const hm = (takenAt: string) => takenAt.slice(11, 16);

/**
 * 사진 단위 매칭 → 질문 단위 묶음. 스킬·Studio 는 사진마다 묻지 않고 이 묶음으로 묻는다.
 * - confirm: 확실·좌표 확인 — "계획대로 다닌 곳" 일괄 확인 목록 (일정 하나 = 한 줄)
 * - ask: 어긋남 — 같은 (계획 일정, 좌표 일정) 쌍이 이어지면 한 묶음 = 질문 하나
 */
export function groupMatches(photos: { id: string; takenAt: string | null }[], matches: Record<string, PlanMatch>, schedule: PlanItem[]) {
  const byId = new Map(schedule.map((s) => [s.id, s]));
  const planned = (id: string) => {
    const s = byId.get(id);
    return s?.start_time ? `${s.start_time}${s.end_time ? `–${s.end_time}` : ''}` : undefined;
  };
  const confirm = new Map<string, ConfirmGroup>();
  const ask: AskGroup[] = [];
  const sorted = photos.filter((p) => p.takenAt && matches[p.id]).sort((a, b) => a.takenAt!.localeCompare(b.takenAt!));
  for (const p of sorted) {
    const m = matches[p.id];
    if (!m.item || !m.title) continue;
    if (m.confidence === 'confident' || m.confidence === 'place') {
      const g = confirm.get(m.item);
      if (g) {
        g.photos.push(p.id);
        g.last = hm(p.takenAt!);
      } else confirm.set(m.item, { day: m.day, item: m.item, title: m.title, location: m.location, planned: planned(m.item), photos: [p.id], first: hm(p.takenAt!), last: hm(p.takenAt!) });
    } else if (m.confidence === 'conflict' && m.byPlace) {
      const prev = ask[ask.length - 1];
      if (prev && prev.item === m.item && prev.byPlace.item === m.byPlace.item) {
        prev.photos.push(p.id);
        prev.last = hm(p.takenAt!);
      } else {
        ask.push({
          day: m.day,
          item: m.item,
          title: m.title,
          location: m.location,
          planned: planned(m.item),
          photos: [p.id],
          first: hm(p.takenAt!),
          last: hm(p.takenAt!),
          byPlace: { item: m.byPlace.item, title: m.byPlace.title, location: m.byPlace.location },
        });
      }
    }
  }
  return { confirm: [...confirm.values()].sort((a, b) => (a.day + a.first).localeCompare(b.day + b.first)), ask };
}

/** travel-plan 이동수단 → TaleFrame Transport. public(대중교통)은 기차·버스·지하철을 구분하지 못해 물어야 한다 */
export function planTransport(mode: PlanItem['transport_mode'], title = ''): 'walk' | 'car' | 'taxi' | 'plane' | 'ferry' | null {
  if (/페리|ferry|フェリー|배\b/i.test(title)) return 'ferry';
  switch (mode) {
    case 'walk':
      return 'walk';
    case 'car':
      return 'car';
    case 'taxi':
      return 'taxi';
    case 'flight':
      return 'plane';
    default:
      return null;
  }
}
