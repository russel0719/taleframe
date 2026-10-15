import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import { MediaManifest, RoutesFile, Story, WeatherFile, type RouteData, type WeatherDay } from './schema';
import { checkStory } from './validate';

export const STORIES_DIR = path.join(process.cwd(), 'content', 'stories');

export type LoadedStory = {
  story: Story;
  manifest: MediaManifest;
  weather: Record<string, WeatherDay>;
  routes: Record<string, RouteData>;
};

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * content/stories/<slug>/ 를 읽고 검증한다. 검증 오류가 있으면 빌드를 멈춘다 —
 * 깨진 스토리가 조용히 배포되는 것보다 빌드 실패가 낫다.
 */
function loadOne(slug: string): LoadedStory {
  const dir = path.join(STORIES_DIR, slug);
  const story = Story.parse(readJson(path.join(dir, 'story.json')));
  const manifestPath = path.join(dir, 'media.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[${slug}] media.json 이 없다 — \`npm run tf -- media ${slug}\` 를 먼저 실행`);
  }
  const manifest = MediaManifest.parse(readJson(manifestPath));
  const weatherPath = path.join(dir, 'weather.json');
  const weather = fs.existsSync(weatherPath) ? WeatherFile.parse(readJson(weatherPath)) : {};
  const routesPath = path.join(dir, 'routes.json');
  const routes = fs.existsSync(routesPath) ? RoutesFile.parse(readJson(routesPath)) : {};

  const errors = checkStory(story, manifest).filter((i) => i.level === 'error');
  if (errors.length) {
    throw new Error(`[${slug}] 스토리 검증 실패\n` + errors.map((e) => `  ${e.where}: ${e.message}`).join('\n'));
  }
  return { story, manifest, weather, routes };
}

/** 개발 서버에서는 초안도 보여주고, 프로덕션 빌드에서는 published 만 */
const showDrafts = process.env.NODE_ENV !== 'production' || process.env.TALEFRAME_SHOW_DRAFTS === '1';

export const loadAll = cache((): LoadedStory[] => {
  if (!fs.existsSync(STORIES_DIR)) return [];
  return fs
    .readdirSync(STORIES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(STORIES_DIR, d.name, 'story.json')))
    .map((d) => loadOne(d.name))
    .filter((s) => showDrafts || s.story.status === 'published')
    .sort((a, b) => b.story.trip.start.localeCompare(a.story.trip.start));
});

export const loadStory = cache((slug: string): LoadedStory | undefined =>
  loadAll().find((s) => s.story.slug === slug),
);
