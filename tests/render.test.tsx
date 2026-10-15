import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { templateIds } from '@/lib/story/schema';
import { StoryRenderer } from '@/templates/StoryRenderer';
import { manifest, routes, showcase } from './fixtures/showcase';

describe('렌더러', () => {
  const weather = {
    weather: { date: '2026-02-07', place: '교토', code: 3, tMax: 9.1, tMin: 1.2, precipitation: 0, source: 'open-meteo' as const },
  };
  const html = renderToString(<StoryRenderer story={showcase} manifest={manifest} weather={weather} routes={routes} />);

  it('모든 템플릿이 오류 없이 렌더링된다', () => {
    for (const t of templateIds) expect(html, t).toContain(`data-template="${t}"`);
  });

  it('섹션 순서가 story.json 순서와 같다', () => {
    const order = [...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual(showcase.sections.map((s) => s.id));
  });

  it('텍스트가 그대로 들어간다', () => {
    expect(html).toContain('후시미 이나리');
    expect(html).toContain('흐림');
    expect(html).toContain('Open-Meteo');
  });

  it('첫 화면 이미지만 즉시 로드하고 나머지는 지연 로드한다', () => {
    const eager = html.match(/loading="eager"/g) ?? [];
    expect(eager.length).toBe(1);
    expect(html).toContain('loading="lazy"');
  });

  it('srcset 으로 여러 폭을 내보낸다', () => {
    expect(html).toMatch(/srcSet="[^"]*640w, [^"]*1280w"/);
  });
});
