import fs from 'node:fs';
import path from 'node:path';
import { readJson, workDir } from './common';

export type LngLat = [number, number];

export function haversine(a: LngLat, b: LngLat) {
  const R = 6371000;
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[1] - a[1]) / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(r(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 숙소 반경 — 이 안의 좌표는 공개하지 않는다 */
export const LODGING_RADIUS_M = 200;

const LODGING_TYPE = /\b(hotel|hostel|guest_house|motel|apartment|chalet|camp_site)\b/i;
const LODGING_NAME = /hotel|hostel|inn\b|ホテル|旅館|民宿|호텔|모텔|게스트하우스|료칸/i;

export function isLodging(c: { type?: string; name?: string; display?: string }) {
  return LODGING_TYPE.test(c.type ?? '') || LODGING_NAME.test(c.name ?? '');
}

/** tf places 가 표시한 숙소 후보 지점 (없으면 빈 배열) */
export function lodgingPoints(slug: string): LngLat[] {
  const p = path.join(workDir(slug), 'places.json');
  if (!fs.existsSync(p)) return [];
  return readJson<{ lat: number; lng: number; lodging?: boolean }[]>(p)
    .filter((c) => c.lodging)
    .map((c) => [c.lng, c.lat]);
}

export const nearLodging = (p: LngLat, lodging: LngLat[]) => lodging.some((q) => haversine(p, q) < LODGING_RADIUS_M);
