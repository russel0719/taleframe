
export type LngLat = [number, number];

export function haversine(a: LngLat, b: LngLat) {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 숙소로 보이는 장소 후보 — tf places 가 표시만 한다 (공개해도 된다: 사용자 결정 2026-10-26) */
const LODGING_TYPE = /\b(hotel|hostel|guest_house|motel|apartment|chalet|camp_site)\b/i;
const LODGING_NAME = /hotel|hostel|inn\b|ホテル|旅館|民宿|호텔|모텔|게스트하우스|료칸/i;

export function isLodging(c: { type?: string; name?: string; display?: string }) {
  return LODGING_TYPE.test(c.type ?? '') || LODGING_NAME.test(c.name ?? '');
}
