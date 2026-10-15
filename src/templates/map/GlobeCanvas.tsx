'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import Map, { type MapRef } from 'react-map-gl/maplibre';
import { localizeLabels, MAP_STYLE } from './mapStyle';

type Props = { target: { lat: number; lng: number; zoom?: number }; land: boolean; reduce: boolean };

/** 지구본이 천천히 돌다가, land 가 켜지면 목적지로 내려간다 */
export default function GlobeCanvas({ target, land, reduce }: Props) {
  const ref = useRef<MapRef>(null);
  const spin = useRef(0);

  useEffect(() => {
    const map = ref.current?.getMap();
    if (!map) return;
    cancelAnimationFrame(spin.current);
    if (land) {
      const dest = { center: [target.lng, target.lat] as [number, number], zoom: target.zoom ?? 9 };
      if (reduce) map.jumpTo(dest);
      else map.flyTo({ ...dest, duration: 6500, curve: 1.6, essential: true });
      return;
    }
    if (reduce) return;
    const tick = () => {
      const c = map.getCenter();
      map.setCenter([c.lng + 0.06, c.lat]);
      spin.current = requestAnimationFrame(tick);
    };
    spin.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(spin.current);
  }, [land, reduce, target.lat, target.lng, target.zoom]);

  return (
    <Map
      ref={ref}
      initialViewState={{ longitude: target.lng - 70, latitude: 18, zoom: 1.3 }}
      mapStyle={MAP_STYLE.color}
      projection="globe"
      interactive={false}
      attributionControl={{ compact: true }}
      onLoad={(e) => localizeLabels(e.target)}
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
