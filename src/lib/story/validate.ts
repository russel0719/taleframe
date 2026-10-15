import { catalog, mediaRefs } from '@/templates/catalog';
import { stopsKey } from './routes';
import type { MediaManifest, Story } from './schema';

export type Issue = { level: 'error' | 'warning'; where: string; message: string };

export type Extras = {
  /** weather.json 에 있는 섹션 id */
  weather?: Set<string>;
  /** routes.json 의 섹션 id → 지문 */
  routes?: Record<string, string>;
};

/**
 * 스키마로 잡히지 않는 의미 검증. 스크립트(`tf validate`)와 빌드 로더, 테스트가 함께 쓴다.
 * manifest 를 주지 않으면 미디어 존재 여부는 검사하지 않는다 (media.json 생성 전 단계).
 */
export function checkStory(story: Story, manifest?: MediaManifest, extras: Extras = {}): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message });
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message });

  if (story.trip.end && story.trip.end < story.trip.start) err('trip', 'end 가 start 보다 이르다');

  const kindOf = (id: string) => manifest?.items[id]?.kind;
  const checkRef = (where: string, id: string, want: 'image' | 'video' | 'any') => {
    if (!manifest) return;
    const kind = kindOf(id);
    if (!kind) err(where, `${id} 가 media.json 에 없다 — \`tf media ${story.slug}\` 를 돌렸는지 확인`);
    else if (want !== 'any' && kind !== want) err(where, `${id} 는 ${kind} 인데 ${want} 가 필요하다`);
  };

  checkRef('cover', story.cover, 'image');

  const seen = new Set<string>();
  const used = new Set<string>([story.cover]);
  story.sections.forEach((s, i) => {
    const where = `sections[${i}] (${s.id})`;
    if (seen.has(s.id)) err(where, `섹션 id 중복: ${s.id}`);
    seen.add(s.id);

    for (const r of mediaRefs(s)) {
      used.add(r.id);
      checkRef(`${where}.${r.path}`, r.id, r.kind);
    }

    if (story.status === 'published' && s.status !== 'approved') {
      err(where, `published 스토리인데 섹션 상태가 ${s.status} — 사용자 승인 후 approved 로 바꾼다`);
    }

    const prev = story.sections[i - 1];
    if (prev && prev.template === s.template) {
      warn(where, `${s.template} 가 연달아 나온다 — 의도한 게 아니라면 다른 템플릿을 고려`);
    }
    if (prev && catalog[prev.template].tall && catalog[s.template].tall) {
      warn(where, `긴 스크롤 장면(${prev.template} → ${s.template})이 붙어 있다 — 사이에 짧은 섹션을 두면 덜 지친다`);
    }

    if (s.template === 'weather-card' && extras.weather && !extras.weather.has(s.id)) {
      warn(where, `날씨 데이터가 없다 — \`tf weather ${story.slug}\` 실행 필요`);
    }
    if (s.template === 'map-journey') {
      if (extras.routes) {
        const key = extras.routes[s.id];
        if (!key) warn(where, `경로가 없어 직선으로 그려진다 — \`tf routes ${story.slug}\``);
        else if (key !== stopsKey(s.stops)) warn(where, `장소가 바뀌어 경로가 낡았다 — \`tf routes ${story.slug}\``);
      }
      s.stops.forEach((st, j) => {
        const p = s.stops[j - 1];
        if (p && Math.abs(p.lat - st.lat) < 1e-4 && Math.abs(p.lng - st.lng) < 1e-4) {
          warn(`${where}.stops[${j}]`, '앞 장소와 좌표가 같다');
        }
      });
    }
    if (s.template === 'panorama' && manifest) {
      const m = manifest.items[s.media];
      if (m && Math.abs(m.width / m.height - 2) > 0.1) {
        warn(`${where}.media`, `파노라마는 2:1 이어야 한다 (현재 ${(m.width / m.height).toFixed(2)}:1)`);
      }
    }
  });

  for (const [id, opt] of Object.entries(story.media ?? {})) {
    if (!used.has(id)) warn(`media.${id}`, '어느 섹션에서도 쓰지 않는 미디어 옵션');
    if (opt.trim) {
      if (opt.trim.end <= opt.trim.start) err(`media.${id}.trim`, 'end 가 start 보다 커야 한다');
      if (manifest && kindOf(id) && kindOf(id) !== 'video') err(`media.${id}.trim`, '영상에만 trim 을 줄 수 있다');
    }
  }
  if (manifest) {
    for (const id of used) {
      if (kindOf(id) === 'image' && !story.media?.[id]?.alt) warn(`media.${id}`, 'alt(화면 묘사)가 없다');
    }
  }

  return issues;
}
