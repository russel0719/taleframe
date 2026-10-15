'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import along from '@turf/along';
import { lineString } from '@turf/helpers';
import length from '@turf/length';
import type { FeatureCollection, LineString } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, Source, type MapRef } from 'react-map-gl/maplibre';
import type { RouteData, SectionOf } from '@/lib/story/schema';
import { localizeLabels, MAP_STYLE } from './mapStyle';

type Stop = SectionOf<'map-journey'>['stops'][number];
type Leg = { coords: number[][]; dashed: boolean; km: number };

/** routes.json 의 실제 길 경로. 없으면 장소끼리 점선 직선 */
function buildLegs(stops: Stop[], route?: RouteData): Leg[] {
  return stops.slice(1).map((b, i) => {
    const a = stops[i];
    const leg = route?.legs[i];
    const coords = leg ? leg.coords : [[a.lng, a.lat], [b.lng, b.lat]];
    return { coords, dashed: !leg || leg.mode === 'straight', km: length(lineString(coords)) };
  });
}

/** 구간 i 를 t(0~1) 만큼만 — 선이 길을 따라 자라나게 */
function partial(leg: Leg, t: number): number[][] {
  if (t >= 1) return leg.coords;
  const target = leg.km * t;
  const out = [leg.coords[0]];
  let acc = 0;
  for (let k = 1; k < leg.coords.length; k++) {
    const seg = length(lineString([leg.coords[k - 1], leg.coords[k]]));
    if (acc + seg >= target) {
      const line = lineString([leg.coords[k - 1], leg.coords[k]]);
      out.push(along(line, target - acc).geometry.coordinates);
      return out;
    }
    acc += seg;
    out.push(leg.coords[k]);
  }
  return out;
}

/**
 * 지금까지 지나온 구간을 그린다. drawn = 2.4 면 0→1, 1→2 구간 전체와 2→3 구간의 40%.
 */
function routeData(legs: Leg[], drawn: number): FeatureCollection<LineString, { dashed: boolean }> {
  const features = [];
  for (let i = 0; i < legs.length; i++) {
    const t = Math.min(1, drawn - i);
    if (t <= 0) break;
    const coords = partial(legs[i], t);
    if (coords.length < 2) break;
    features.push({
      type: 'Feature' as const,
      properties: { dashed: legs[i].dashed },
      geometry: { type: 'LineString' as const, coordinates: coords },
    });
  }
  return { type: 'FeatureCollection', features };
}

function bounds(coords: number[][]): [[number, number], [number, number]] {
  const xs = coords.map((c) => c[0]);
  const ys = coords.map((c) => c[1]);
  return [
    [Math.min(...xs), Math.min(...ys)],
    [Math.max(...xs), Math.max(...ys)],
  ];
}

export default function JourneyCanvas({
  stops,
  route,
  active,
  reduce,
}: {
  stops: Stop[];
  route?: RouteData;
  active: number;
  reduce: boolean;
}) {
  const ref = useRef<MapRef>(null);
  const [loaded, setLoaded] = useState(false);
  const [drawn, setDrawn] = useState(0);
  const drawnRef = useRef(0);

  const legs = useMemo(() => buildLegs(stops, route), [stops, route]);

  // 카메라: 방금 지나온 구간 전체가 들어오게 (길이 휘어 있으면 그 굽이까지)
  useEffect(() => {
    const map = ref.current?.getMap();
    if (!map || !loaded) return;
    const cur = stops[active];
    const opts = { padding: 80, maxZoom: 16, duration: reduce ? 0 : 1800, essential: true };
    if (active === 0) map.flyTo({ center: [cur.lng, cur.lat], zoom: 14, duration: opts.duration, essential: true });
    else map.fitBounds(bounds(legs[active - 1].coords), opts);
  }, [active, loaded, reduce, stops, legs]);

  // 경로: 현재 장소까지 선이 자라난다
  useEffect(() => {
    const from = drawnRef.current;
    const to = active;
    if (reduce || from === to) {
      drawnRef.current = to;
      setDrawn(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const dur = 1400;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = from + (to - from) * eased;
      drawnRef.current = v;
      setDrawn(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, reduce]);

  const data = useMemo(() => routeData(legs, drawn), [legs, drawn]);
  const first = stops[0];

  return (
    <Map
      ref={ref}
      initialViewState={{ longitude: first.lng, latitude: first.lat, zoom: 12 }}
      mapStyle={MAP_STYLE.light}
      interactive={false}
      attributionControl={{ compact: true }}
      onLoad={(e) => {
        localizeLabels(e.target);
        setLoaded(true);
      }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Source id="route" type="geojson" data={data}>
        <Layer
          id="route-solid"
          type="line"
          filter={['==', ['get', 'dashed'], false]}
          paint={{ 'line-color': '#0066cc', 'line-width': 4, 'line-opacity': 0.9 }}
          layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        />
        <Layer
          id="route-dashed"
          type="line"
          filter={['==', ['get', 'dashed'], true]}
          paint={{ 'line-color': '#0066cc', 'line-width': 3, 'line-dasharray': [1.5, 1.5] }}
        />
      </Source>
      {stops.map((s, i) => (
        <Marker key={i} longitude={s.lng} latitude={s.lat} anchor="center">
          <div
            className={`grid h-7 w-7 place-items-center rounded-full border-2 text-[12px] font-semibold transition-all duration-500 ${
              i === active
                ? 'scale-125 border-white bg-primary text-white'
                : i < active
                  ? 'border-white bg-primary/80 text-white'
                  : 'border-primary/60 bg-white text-primary'
            }`}
          >
            {i + 1}
          </div>
        </Marker>
      ))}
    </Map>
  );
}
