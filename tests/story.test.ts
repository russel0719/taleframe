import { describe, expect, it } from 'vitest';
import { fileNames } from '@/lib/media';
import { ambientPlan, resolveAll } from '@/lib/resolve';
import { profileFor, stopsKey } from '@/lib/story/routes';
import { Story, templateIds, type SectionOf } from '@/lib/story/schema';
import { checkStory } from '@/lib/story/validate';
import { buildLab, labSection, pickMedia } from '@/lib/lab';
import { catalog, collectUsage } from '@/templates/catalog';
import { registry } from '@/templates/registry';
import { resolveTones } from '@/templates/StoryRenderer';
import { expectedFiles } from '../scripts/lib/derive';
import { manifest, showcase } from './fixtures/showcase';

const clone = <T>(v: T): T => structuredClone(v);

describe('스키마', () => {
  it('쇼케이스가 통과하고 모든 템플릿을 쓴다', () => {
    const parsed = Story.parse(showcase);
    const used = new Set(parsed.sections.map((s) => s.template));
    expect([...templateIds].filter((t) => !used.has(t))).toEqual([]);
  });

  it('카탈로그와 레지스트리가 스키마의 모든 템플릿을 덮는다', () => {
    for (const id of templateIds) {
      expect(catalog[id], id).toBeDefined();
      expect(registry[id], id).toBeDefined();
    }
  });

  it('등록되지 않은 템플릿을 거부한다', () => {
    const bad = clone(showcase) as unknown as { sections: Record<string, unknown>[] };
    bad.sections[0].template = 'custom-html';
    expect(Story.safeParse(bad).success).toBe(false);
  });

  it('모르는 필드를 조용히 버리지 않는다 (LLM 오타 방지)', () => {
    const bad = clone(showcase) as unknown as { sections: Record<string, unknown>[] };
    bad.sections[0].captoin = '오타';
    expect(Story.safeParse(bad).success).toBe(false);
  });

  it('미디어 id 형식과 글자 수 제한을 지킨다', () => {
    const bad = clone(showcase);
    (bad.sections[0] as { media: string }).media = '../../etc/passwd';
    expect(Story.safeParse(bad).success).toBe(false);
    const long = clone(showcase);
    (long.sections[0] as { title: string }).title = '가'.repeat(41);
    expect(Story.safeParse(long).success).toBe(false);
  });

  it('recommendation 은 목록이 하나는 있어야 한다', () => {
    const bad = clone(showcase);
    const i = bad.sections.findIndex((s) => s.template === 'recommendation');
    bad.sections[i] = { id: 'reco', status: 'approved', template: 'recommendation' };
    expect(Story.safeParse(bad).success).toBe(false);
  });
});

describe('의미 검증', () => {
  const errors = (st: Story) => checkStory(st, manifest).filter((i) => i.level === 'error');

  it('쇼케이스는 오류가 없다', () => {
    expect(errors(showcase)).toEqual([]);
  });

  it('없는 미디어를 잡는다', () => {
    const st = clone(showcase);
    (st.sections[8] as { media: string }).media = 'm999';
    expect(errors(st).map((e) => e.message).join()).toContain('m999');
  });

  it('사진 자리에 영상을 넣으면 잡는다', () => {
    const st = clone(showcase);
    (st.sections[8] as { media: string }).media = 'm010';
    expect(errors(st).some((e) => e.message.includes('video'))).toBe(true);
  });

  it('published 인데 승인 안 된 섹션이 있으면 오류', () => {
    const st = clone(showcase);
    st.sections[3].status = 'needs_review';
    expect(errors(st).some((e) => e.where.includes('ch1'))).toBe(true);
    st.status = 'draft';
    expect(errors(st)).toEqual([]);
  });

  it('섹션 id 중복을 잡는다', () => {
    const st = clone(showcase);
    st.sections[1].id = 'hero';
    expect(errors(st).some((e) => e.message.includes('중복'))).toBe(true);
  });

  it('같은 템플릿이 연달아 오면 경고한다', () => {
    const st = clone(showcase);
    st.sections.splice(9, 0, { id: 'dup', status: 'approved', template: 'photo-single', media: 'm003' });
    const warns = checkStory(st, manifest).filter((i) => i.level === 'warning');
    expect(warns.some((w) => w.where.includes('dup'))).toBe(true);
  });
});

describe('미디어', () => {
  it('용도별로 필요한 파생 파일을 정한다', () => {
    const u = collectUsage(showcase.sections);
    expect(u.get('m010')).toEqual({ panorama: false, scrub: true, ambient: true, regular: true });
    expect(u.get('m007')?.panorama).toBe(true);
  });

  it('업로드 목록과 렌더러가 같은 파일 이름을 쓴다', () => {
    const files = expectedFiles(manifest.items.m010);
    const media = resolveAll(showcase, manifest).m010;
    for (const url of [media.video!.src!, media.video!.scrub!, media.video!.ambient!, media.img.src]) {
      expect(files).toContain(url.split('/').pop());
    }
    expect(files).toContain(fileNames.poster('m010-12345678', 1920));
  });

  it('공개 HTML 에 원본 경로가 들어갈 수 없다', () => {
    const urls = JSON.stringify(resolveAll(showcase, manifest));
    expect(urls).not.toMatch(/\/home\/|IMG_|\.MOV|\.jpg"/i);
  });

  it('현장음은 다음 지정까지 이어지고 none 에서 끊긴다', () => {
    const plan = ambientPlan(showcase, resolveAll(showcase, manifest));
    expect(plan[0]).toMatch(/m010-12345678-ambient\.m4a$/);
    expect(plan[4]).toBe(plan[0]);
    expect(plan[5]).toBeNull();
  });
});

describe('작품 섹션', () => {
  it('작품 섹션이 연달아 오면 경고한다', () => {
    const st = clone(showcase);
    const i = st.sections.findIndex((x) => x.id === 'note1');
    st.sections.splice(i, 1); // verse 다음에 바로 color-field
    const warns = checkStory(st, manifest).filter((w) => w.level === 'warning');
    expect(warns.some((w) => w.message.includes('작품 섹션'))).toBe(true);
  });

  it('필름 가장자리 글자는 영문 대문자만', () => {
    const st = clone(showcase);
    (st.sections.find((x) => x.id === 'film') as { label?: string }).label = '교토';
    expect(Story.safeParse(st).success).toBe(false);
  });
});

describe('실험실', () => {
  it('모든 템플릿을 실제 미디어로 한 번씩 그린다', () => {
    const lab = buildLab({ story: showcase, manifest });
    expect(lab.skipped).toEqual([]);
    expect(lab.story.sections.map((s) => s.template).sort()).toEqual([...templateIds].sort());
    expect(Story.safeParse(lab.story).success).toBe(true);
    expect(checkStory(lab.story, manifest).filter((i) => i.level === 'error')).toEqual([]);
  });

  it('영상이 없으면 영상 템플릿만 건너뛰고 알린다', () => {
    const imagesOnly = { ...manifest, items: Object.fromEntries(Object.entries(manifest.items).filter(([, m]) => m.kind === 'image')) };
    const pick = pickMedia(imagesOnly);
    expect(labSection('scroll-scrub', pick)).toBeNull();
    expect(labSection('verse', pick)).not.toBeNull();
  });
});

describe('경로', () => {
  const map = () => showcase.sections.find((x) => x.template === 'map-journey') as SectionOf<'map-journey'>;

  it('장소가 바뀌면 낡은 경로를 경고한다', () => {
    const key = stopsKey(map().stops);
    const ok = checkStory(showcase, manifest, { routes: { map: key } });
    expect(ok.some((i) => i.message.includes('경로'))).toBe(false);

    const st = clone(showcase);
    const m = st.sections.find((x) => x.template === 'map-journey') as SectionOf<'map-journey'>;
    m.stops[1].lat += 0.01;
    expect(checkStory(st, manifest, { routes: { map: key } }).some((i) => i.message.includes('낡았다'))).toBe(true);
    expect(checkStory(st, manifest, { routes: {} }).some((i) => i.message.includes('직선'))).toBe(true);
  });

  it('철도·항공은 도로 길찾기로 그리지 않는다', () => {
    expect(profileFor('walk')).toBe('foot');
    expect(profileFor('taxi')).toBe('car');
    expect(profileFor('train')).toBe('straight');
    expect(profileFor('plane')).toBe('straight');
    expect(profileFor(undefined)).toBe('straight');
  });
});

describe('톤', () => {
  it('같은 톤이 연달아 오면 한 단계 바꾼다', () => {
    const tones = resolveTones(showcase.sections);
    for (let i = 1; i < tones.length; i++) {
      if (!showcase.sections[i].tone) expect(tones[i], showcase.sections[i].id).not.toBe(tones[i - 1]);
    }
  });
});
