import fs from 'node:fs';
import path from 'node:path';
import { profileFor, stopsKey } from '@/lib/story/routes';
import { RoutesFile, Story, type RouteData, type RouteLeg } from '@/lib/story/schema';
import { readJson, sleep, storyDir, workDir, writeJson } from './common';
import { haversine } from './geo';
import type { Inventory } from './scan';

/**
 * map-journey · walk-line 의 구간마다 실제 길을 따라가는 경로를 받아 routes.json 에 고정한다.
 * 길찾기: FOSSGIS 가 운영하는 OSRM (OpenStreetMap 데이터, 키 없음, 적정 사용).
 * https://routing.openstreetmap.de/about.html
 *
 * 두 장소 사이에 찍은 사진의 GPS 를 경유지로 넣어 실제로 지나간 길에 가깝게 맞춘다.
 * 그래도 GPS 궤적은 아니다 — 렌더러가 그 사실을 지도 아래에 적는다.
 */
const UA = 'TaleFrame/0.1 (personal travel story builder)';
const MAX_VIA = 10;
const MIN_GAP_M = 60;


function pathLength(coords: [number, number][]) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += haversine(coords[i - 1], coords[i]);
  return m;
}

/** 두 장소의 사진 촬영 시각 사이에 찍힌 사진들의 GPS (시간순, 너무 가까운 점은 버린다) */
function waypoints(inv: Inventory | null, fromMedia?: string, toMedia?: string, ends: [number, number][] = []) {
  if (!inv || !fromMedia || !toMedia) return [];
  const byId = new Map(inv.items.map((it) => [it.id, it]));
  const t0 = byId.get(fromMedia)?.takenAt;
  const t1 = byId.get(toMedia)?.takenAt;
  if (!t0 || !t1 || t0 >= t1) return [];
  const pts: [number, number][] = [];
  for (const it of [...inv.items].sort((a, b) => (a.takenAt ?? '').localeCompare(b.takenAt ?? ''))) {
    if (!it.gps || !it.takenAt || it.takenAt <= t0 || it.takenAt >= t1) continue;
    const p: [number, number] = [it.gps.lng, it.gps.lat];
    if ([...ends, ...pts].some((q) => haversine(p, q) < MIN_GAP_M)) continue;
    pts.push(p);
  }
  return pts.slice(0, MAX_VIA);
}

async function osrm(profile: 'foot' | 'bike' | 'car', points: [number, number][]): Promise<[number, number][]> {
  const coords = points.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  // 네트워크 오류(타임아웃·연결 끊김)는 경유지 탓이 아니므로 몇 번 다시 시도한다
  let res: Response | undefined;
  for (let attempt = 1; ; attempt++) {
    try {
      res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) });
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(2000 * attempt);
    }
  }
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const j = (await res.json()) as { code: string; routes?: { geometry: { coordinates: [number, number][] } }[] };
  if (j.code !== 'Ok' || !j.routes?.length) throw new Error(`OSRM ${j.code}`);
  await sleep(1100);
  return j.routes[0].geometry.coordinates;
}

const round = (c: [number, number][]) =>
  c
    .map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5] as [number, number])
    .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);

export async function routes(slug: string, { force = false } = {}) {
  const dir = storyDir(slug);
  const story = Story.parse(readJson(path.join(dir, 'story.json')));
  const file = path.join(dir, 'routes.json');
  const prev = fs.existsSync(file) ? RoutesFile.parse(readJson(file)) : {};
  const invPath = path.join(workDir(slug), 'inventory.json');
  const inv = fs.existsSync(invPath) ? readJson<Inventory>(invPath) : null;
  if (!inv) console.log('· work/ 에 inventory 가 없어 사진 경유지 없이 장소끼리만 잇는다');

  const out: Record<string, RouteData> = {};
  const journeys = story.sections.filter((s) => s.template === 'map-journey' || s.template === 'walk-line');
  if (!journeys.length) {
    console.log('· map-journey · walk-line 섹션이 없다');
    return;
  }
  for (const s of journeys) {
    const key = stopsKey(s.stops);
    if (!force && prev[s.id]?.key === key) {
      out[s.id] = prev[s.id];
      console.log(`  = ${s.id}: 바뀐 것이 없어 그대로 둔다`);
      continue;
    }
    const legs: RouteLeg[] = [];
    for (let i = 1; i < s.stops.length; i++) {
      const a = s.stops[i - 1];
      const b = s.stops[i];
      const ends: [number, number][] = [
        [a.lng, a.lat],
        [b.lng, b.lat],
      ];
      const profile = profileFor(b.transport);
      if (!b.transport) console.log(`  · ${s.id} ${i}구간: transport 가 없어 점선 직선으로 그린다`);
      let coords: [number, number][] = ends;
      let via = 0;
      if (profile !== 'straight') {
        const vias = waypoints(inv, a.media, b.media, ends);
        try {
          coords = await osrm(profile, [ends[0], ...vias, ends[1]]);
          via = vias.length;
        } catch (e) {
          // 경유지 때문에 길이 안 나오면 경유지 없이 한 번 더
          console.log(`  · ${s.id} ${i}구간: ${(e as Error).message} — 경유지 없이 다시 시도`);
          coords = await osrm(profile, ends);
        }
      }
      const rounded = round(coords);
      legs.push({ mode: profile, coords: rounded, meters: Math.round(pathLength(rounded)), via });
      console.log(
        `  ✓ ${s.id} ${i}. ${a.name} → ${b.name}: ${profile} ${(legs[i - 1].meters / 1000).toFixed(2)}km` +
          (via ? ` (사진 경유지 ${via}곳)` : ''),
      );
    }
    out[s.id] = { key, source: 'osrm-fossgis', legs };
  }
  writeJson(file, out);
  console.log(`✓ ${path.relative(process.cwd(), file)} · 경로 © OpenStreetMap contributors, OSRM (FOSSGIS)`);
}
