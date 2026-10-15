import fs from 'node:fs';
import path from 'node:path';
import { Story, WeatherFile, type WeatherDay } from '@/lib/story/schema';
import { readJson, storyDir, writeJson } from './common';

/**
 * weather-card 섹션마다 Open-Meteo Historical API 로 그날의 실측 기록을 받아 weather.json 에 저장한다.
 * 빌드 시점에 네트워크를 타지 않도록 결과를 파일로 고정해 둔다.
 */
export async function weather(slug: string) {
  const dir = storyDir(slug);
  const story = Story.parse(readJson(path.join(dir, 'story.json')));
  const file = path.join(dir, 'weather.json');
  const prev = fs.existsSync(file) ? WeatherFile.parse(readJson(file)) : {};
  const out: Record<string, WeatherDay> = {};

  const cards = story.sections.filter((s) => s.template === 'weather-card');
  if (!cards.length) {
    console.log('· weather-card 섹션이 없다');
    return;
  }
  for (const s of cards) {
    const old = prev[s.id];
    if (old && old.date === s.date && old.place === s.place.name) {
      out[s.id] = old;
      continue;
    }
    const q = new URLSearchParams({
      latitude: String(s.place.lat),
      longitude: String(s.place.lng),
      start_date: s.date,
      end_date: s.date,
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
      timezone: 'auto',
    });
    const res = await fetch(`https://archive-api.open-meteo.com/v1/archive?${q}`);
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as {
      daily: { weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[] };
    };
    const d = j.daily;
    if (d.weather_code[0] == null) throw new Error(`${s.id}: ${s.date} 기록이 아직 없다 (보통 며칠 늦게 들어온다)`);
    out[s.id] = {
      date: s.date,
      place: s.place.name,
      code: d.weather_code[0],
      tMax: d.temperature_2m_max[0],
      tMin: d.temperature_2m_min[0],
      precipitation: d.precipitation_sum[0],
      source: 'open-meteo',
    };
    console.log(`  ✓ ${s.id}: ${s.date} ${s.place.name} — ${out[s.id].tMin}~${out[s.id].tMax}°C, 강수 ${out[s.id].precipitation}mm`);
  }
  writeJson(file, out);
  console.log(`✓ ${path.relative(process.cwd(), file)} (Weather data by Open-Meteo.com, CC BY 4.0)`);
}
