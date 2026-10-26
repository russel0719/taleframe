'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useMemo } from 'react';
import Map, { Marker } from 'react-map-gl/maplibre';
import { localizeLabels, MAP_STYLE } from './mapStyle';

type Point = { lat: number; lng: number; thumb: string; position: string };

/**
 * 사진 지도 — 찍은 자리마다 둥근 썸네일. 페이지 스크롤을 가로채지 않게 두 손가락(모바일)·Ctrl+휠(데스크톱)로만 움직인다.
 * 같은 칸(약 100m)에 겹친 사진은 살짝 벌려 놓는다.
 */
export default function PhotoMapCanvas({ points, onPick }: { points: Point[]; onPick: (i: number) => void }) {
  const bounds = useMemo(() => {
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    const pad = 0.002;
    return [
      [Math.min(...lngs) - pad, Math.min(...lats) - pad],
      [Math.max(...lngs) + pad, Math.max(...lats) + pad],
    ] as [[number, number], [number, number]];
  }, [points]);
  const offsets = useMemo(() => {
    const seen: Record<string, number> = {};
    return points.map((p) => {
      const k = `${p.lat},${p.lng}`;
      const n = (seen[k] = (seen[k] ?? -1) + 1);
      const a = n * 2.4;
      return n ? [Math.cos(a) * 14 * Math.sqrt(n), Math.sin(a) * 14 * Math.sqrt(n)] : [0, 0];
    });
  }, [points]);

  return (
    <Map
      initialViewState={{ bounds, fitBoundsOptions: { padding: 48 } }}
      mapStyle={MAP_STYLE.light}
      cooperativeGestures
      dragRotate={false}
      attributionControl={{ compact: true }}
      onLoad={(e) => localizeLabels(e.target)}
      style={{ position: 'absolute', inset: 0 }}
    >
      {points.map((p, i) => (
        <Marker key={i} longitude={p.lng} latitude={p.lat} anchor="center" offset={offsets[i] as [number, number]}>
          <button
            type="button"
            onClick={() => onPick(i)}
            aria-label={`사진 ${i + 1} 보기`}
            className="block h-11 w-11 overflow-hidden rounded-full border-[3px] border-white shadow-[0_2px_10px_rgba(0,0,0,.3)] transition-transform hover:z-10 hover:scale-150"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- 지도 위 작은 썸네일 */}
            <img src={p.thumb} alt="" loading="lazy" className="h-full w-full object-cover" style={{ objectPosition: p.position }} />
          </button>
        </Marker>
      ))}
    </Map>
  );
}
