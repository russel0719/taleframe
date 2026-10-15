// MapLibre 6 의 웹 워커는 번들러(Turbopack)가 따라가지 못해 정적 파일로 서빙한다.
// dev/build 전에 실행된다 (package.json pre 스크립트). 버전을 파일명에 넣어 캐시가 엇갈리지 않게 한다.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/maplibre-gl/package.json'), 'utf8'));
const out = path.join(root, 'public/vendor');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(
  path.join(root, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'),
  path.join(out, `maplibre-gl-worker-${pkg.version}.mjs`),
);
