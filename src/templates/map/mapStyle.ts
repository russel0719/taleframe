import { getVersion, setWorkerUrl, type Map as MlMap } from 'maplibre-gl';
import { basePath } from '@/lib/media';

// 워커는 scripts/copy-vendor.mjs 가 public/vendor/ 에 복사해 둔 정적 파일을 쓴다 (Pages 경로 접두사 포함)
setWorkerUrl(`${basePath}/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

/** OpenFreeMap — 무료, API 키 없음. 저작자 표시는 MapLibre 기본 컨트롤이 붙인다 */
export const MAP_STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  color: 'https://tiles.openfreemap.org/styles/liberty',
};

/** 지명 라벨을 한국어 우선으로 */
export function localizeLabels(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (!field) continue;
    const text = JSON.stringify(field);
    if (!text.includes('name')) continue;
    map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ko'], ['get', 'name']]);
  }
}
