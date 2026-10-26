import fs from 'node:fs';
import path from 'node:path';
import { readJson, sleep, workDir, writeJson } from './common';
import { haversine as distance, isLodging } from './geo';
import { loadInventory } from './scan';

/**
 * GPS 로 촬영 지점을 묶고 OpenStreetMap Nominatim 으로 장소명 **후보**를 붙인다.
 * 결과는 work/ 에만 남는다 (좌표 원본은 공개하지 않는다). 확정은 사용자 몫이다.
 *
 * Nominatim 이용 정책: 초당 1회, 식별 가능한 User-Agent, 결과 캐시.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
const UA = 'TaleFrame/0.1 (personal travel story builder)';
const RADIUS_M = 250;

type Cluster = {
  n: number;
  lat: number;
  lng: number;
  ids: string[];
  from: string | null;
  to: string | null;
  candidate?: { name: string; area: string; type: string; display: string };
  /** 숙소로 보이는 지점 (표시만 — 숙소 위치는 공개해도 된다, 사용자 결정 2026-10-26) */
  lodging?: boolean;
};


type NominatimResult = {
  name?: string;
  display_name?: string;
  type?: string;
  category?: string;
  address?: Record<string, string>;
};

async function reverse(lat: number, lng: number, cache: Record<string, NominatimResult>) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache[key]) return cache[key];
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=ko,en`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const j = (await res.json()) as NominatimResult;
  cache[key] = j;
  await sleep(1100);
  return j;
}

export async function places(slug: string) {
  const inv = loadInventory(slug);
  const pts = inv.items
    .filter((it) => it.gps)
    .sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? ''));
  if (!pts.length) {
    console.log('· GPS 가 있는 미디어가 없다. 장소는 인터뷰로 확인한다.');
    return;
  }

  // 시간순으로 걸으며, 직전 묶음 중심에서 RADIUS_M 안이면 같은 묶음
  const clusters: Cluster[] = [];
  for (const it of pts) {
    const last = clusters[clusters.length - 1];
    if (last && distance([last.lng, last.lat], [it.gps!.lng, it.gps!.lat]) <= RADIUS_M) {
      last.lat = (last.lat * last.ids.length + it.gps!.lat) / (last.ids.length + 1);
      last.lng = (last.lng * last.ids.length + it.gps!.lng) / (last.ids.length + 1);
      last.ids.push(it.id);
      last.to = it.takenAt;
    } else {
      clusters.push({ n: clusters.length + 1, lat: it.gps!.lat, lng: it.gps!.lng, ids: [it.id], from: it.takenAt, to: it.takenAt });
    }
  }

  const cachePath = path.join(workDir(slug), 'geocode-cache.json');
  const cache: Record<string, NominatimResult> = fs.existsSync(cachePath) ? readJson(cachePath) : {};
  console.log(`· 촬영 지점 ${clusters.length}곳 — Nominatim 조회 (초당 1회)…`);
  for (const c of clusters) {
    try {
      const r = await reverse(c.lat, c.lng, cache);
      const a = r.address ?? {};
      c.candidate = {
        name: r.name || a.attraction || a.tourism || a.amenity || a.shop || a.road || '',
        area: [a.city ?? a.town ?? a.village, a.suburb ?? a.city_district ?? a.quarter, a.neighbourhood].filter(Boolean).join(' · '),
        type: [r.category, r.type].filter(Boolean).join('/'),
        display: r.display_name ?? '',
      };
      c.lodging = isLodging(c.candidate);
    } catch (e) {
      console.log(`  ✗ #${c.n}: ${(e as Error).message}`);
    }
  }
  writeJson(cachePath, cache);
  // 좌표는 소수점 4자리(약 10m)로만 남긴다 — map-journey 에 넣을 때는 3자리로 더 줄인다
  for (const c of clusters) {
    c.lat = Math.round(c.lat * 1e4) / 1e4;
    c.lng = Math.round(c.lng * 1e4) / 1e4;
  }
  writeJson(path.join(workDir(slug), 'places.json'), clusters);

  console.log('\n  #   시각              컷  후보 (확정 아님)');
  for (const c of clusters) {
    const t = c.from?.slice(5, 16).replace('T', ' ') ?? '?';
    const name = c.candidate ? `${c.candidate.name || '(이름 없음)'} — ${c.candidate.area} [${c.candidate.type}]` : '(조회 실패)';
    console.log(`  ${String(c.n).padStart(2)}  ${t}  ${String(c.ids.length).padStart(3)}  ${name}${c.lodging ? '  (숙소)' : ''}`);
    console.log(`      ${c.ids.join(' ')}`);
  }
  console.log(`\n✓ work/${slug}/places.json · 장소명은 "후보"다. 반드시 사용자에게 확인받는다.`);
  console.log('  © OpenStreetMap contributors (ODbL)');
}
