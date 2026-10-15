import type { CSSProperties, ComponentType } from 'react';
import { SoundscapeProvider } from '@/components/Soundscape';
import { StoryProvider } from '@/components/StoryContext';
import { StoryNav } from '@/components/StoryNav';
import { ambientPlan, resolveAll } from '@/lib/resolve';
import type { MediaManifest, RouteData, Section, Story, WeatherDay } from '@/lib/story/schema';
import { catalog } from './catalog';
import { registry } from './registry';
import type { TemplateProps } from './types';

type Tone = 'light' | 'parchment' | 'dark' | 'dark-2';

/**
 * 같은 톤이 연달아 오면 자동으로 한 단계 바꿔 구분한다 (design.md: 색 변화 자체가 구분선).
 * 섹션에 tone 을 명시했으면 그대로 둔다.
 */
export function resolveTones(sections: Section[]): Tone[] {
  const out: Tone[] = [];
  sections.forEach((s, i) => {
    let t: Tone = s.tone ?? catalog[s.template].defaultTone;
    const prev = out[i - 1];
    if (!s.tone && prev) {
      if (t === 'light' && prev === 'light') t = 'parchment';
      else if (t === 'parchment' && prev === 'parchment') t = 'light';
      else if (t === 'dark' && prev === 'dark') t = 'dark-2';
    }
    out.push(t);
  });
  return out;
}

const TONE_CLASS: Record<Tone, string> = {
  light: 'tone-light',
  parchment: 'tone-parchment',
  dark: 'tone-dark',
  'dark-2': 'tone-dark-2',
};

/** 편집 미리보기와 게시 결과가 같은 렌더러를 쓴다 — 두 벌의 구현을 두지 않는다 */
export function StoryRenderer({
  story,
  manifest,
  weather,
  routes,
}: {
  story: Story;
  manifest: MediaManifest;
  weather: Record<string, WeatherDay>;
  routes: Record<string, RouteData>;
}) {
  const media = resolveAll(story, manifest);
  const plan = ambientPlan(story, media);
  const tones = resolveTones(story.sections);
  const accent = story.theme?.accent ? ({ '--story-accent': story.theme.accent } as CSSProperties) : undefined;

  return (
    <StoryProvider slug={story.slug} media={media}>
      <SoundscapeProvider plan={plan}>
        <StoryNav title={story.title} draft={story.status === 'draft'} />
        <main style={accent}>
          {story.sections.map((s, i) => {
            const Comp = registry[s.template] as ComponentType<TemplateProps<typeof s.template>>;
            return (
              <section key={s.id} id={s.id} data-section-index={i} data-template={s.template} className={TONE_CLASS[tones[i]]}>
                <Comp section={s} first={i === 0} slug={story.slug} weather={weather[s.id]} route={routes[s.id]} />
              </section>
            );
          })}
        </main>
      </SoundscapeProvider>
    </StoryProvider>
  );
}
