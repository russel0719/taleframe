import { z } from 'zod';

/**
 * headless 단계별 지시와 응답 스키마.
 * 판단 규칙은 여기 다시 쓰지 않는다 — 스킬 문서(.claude/skills/travel-story/*.md)를 Read 하라고만 한다.
 * 스킬(대화형)과 studio(폰)가 같은 규칙 파일을 읽어야 둘이 갈라지지 않는다.
 */

const MediaIds = z.array(z.string().regex(/^m\d{3,4}$/)).max(4);

// ── 1. 훑어보기 ─────────────────────────────────────────────

export const AnalysisEntry = z.object({
  id: z.string(),
  scene: z.string().describe('보이는 것만, 한 문장'),
  category: z.enum(['landscape', 'food', 'street', 'indoor', 'transport', 'people', 'lodging', 'other']),
  people: z.string().optional(),
  faces: z.boolean(),
  score: z.number().int().min(1).max(5),
  guess: z.string().optional().describe('장소 짐작 — 물음표를 붙인다'),
  note: z.string().optional(),
  exclude: z.string().optional().describe('다른 도구의 결과물·중복·스크린샷이면 이유'),
});
export type AnalysisEntry = z.infer<typeof AnalysisEntry>;
export const AnalysisBatch = z.object({ entries: z.array(AnalysisEntry) });

export function analyzePrompt(slug: string, sheet: string, ids: string[], videos: string[]) {
  return `여행 "${slug}" 의 사진을 훑어본다.
.claude/skills/travel-story/SKILL.md 의 "2. 훑어보기" 절을 Read 로 읽고 그 형식을 따른다.

work/${slug}/${sheet} (12장 밀착 인화지, 칸마다 id 와 촬영 시각) 를 Read 로 본다.
${videos.length ? `영상은 썸네일 세 장(10%·50%·85%)을 함께 본다: ${videos.map((v) => `work/${slug}/thumbs/${v}_a.jpg, _b, _c`).join(' / ')}` : ''}
자세히 봐야 하는 칸만 work/${slug}/thumbs/<id>.jpg 를 연다.

이 시트의 id 전부(${ids.join(', ')})에 대해 항목을 하나씩 돌려준다. 다른 id 는 넣지 않는다.`;
}

// ── 2. 질문 단계 (① 사진 질문 · ② 웹 방향 · ⑤ 보완 질문) ───────────

export const Question = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).describe('짧은 영문 kebab-case'),
  header: z.string().max(14).describe('카드 위 작은 라벨 (보완 질문이면 섹션 이름)'),
  question: z.string().max(240),
  multiSelect: z.boolean(),
  options: z
    .array(z.object({ label: z.string().max(60), description: z.string().max(160).optional() }))
    .min(2)
    .max(5),
  media: MediaIds.describe('이 질문과 함께 보여줄 사진 id (사용자가 보며 답한다)'),
  section: z.string().optional().describe('보완 질문이면 대상 섹션 id'),
});
export type Question = z.infer<typeof Question>;

export const QuestionStep = z.object({
  kind: z.enum(['questions', 'done']).describe('이 단계에서 더 물을 게 없으면 done'),
  message: z.string().max(200).describe('폰 화면 위쪽에 보일 한두 문장'),
  questions: z.array(Question).max(4).optional(),
});
export type QuestionStep = z.infer<typeof QuestionStep>;

export type Phase = 'photos' | 'direction';
const PHASE_NAME: Record<Phase, string> = { photos: '① 사진 질문', direction: '② 웹 방향' };

const READ_COMMON = (slug: string) => `먼저 Read 로 읽는다:
- .claude/skills/travel-story/SKILL.md (절대 규칙)
- .claude/skills/travel-story/interview.md (다섯 단계와 질문 규칙)
- work/${slug}/analysis.json, work/${slug}/interview.json (지금까지의 답 — 없으면 아직 아무것도 묻지 않은 것)
- work/${slug}/places.json (있으면. lodging 지점은 절대 쓰지 않는다)`;

export function phasePrompt(slug: string, phase: Phase) {
  return `여행 "${slug}" 의 스토리를 사용자와 함께 정하는 중이다. 지금은 interview.md 의 **${PHASE_NAME[phase]}** 단계다.

${READ_COMMON(slug)}

- 이 단계에서 정할 것만 묻는다. 다른 단계의 질문(${phase === 'photos' ? '톤·분량·템플릿 같은 웹 모양' : '사진 속 사실 확인'})은 하지 않는다.
- interview.json 에 이미 답이 있는 항목은 다시 묻지 않는다. 답이 일부만 왔으면 빠진 부분만 묻는다.
- 한 번에 최대 4문항. 질문마다 media 에 관련 사진 id 를 1~4개 넣는다 — 사용자는 폰에서 사진을 보며 답하므로 장면 설명은 짧게.
- 사용자는 선택지 외에 직접 입력도 할 수 있다 (선택지에 "기타"를 넣지 않는다).
- 이 단계에서 정할 것이 다 정해졌으면 kind="done" (questions 는 비운다).`;
}

// ── 3. ③ 레이아웃 ────────────────────────────────────────────

export const PlanRow = z.object({
  section: z.string().describe('섹션 id (kebab-case)'),
  kind: z.enum(['기록', '작품']),
  template: z.string(),
  media: MediaIds,
  why: z.string().max(140),
});
export type PlanRow = z.infer<typeof PlanRow>;

export const PlanStep = z.object({
  message: z.string().max(200),
  plan: z.object({
    title: z.string().max(60),
    outline: z.array(z.string().max(120)).max(10).describe('챕터 흐름'),
    rows: z.array(PlanRow).min(1).max(40),
  }),
});
export type PlanStep = z.infer<typeof PlanStep>;

export function layoutPrompt(slug: string) {
  return `여행 "${slug}" 의 **③ 레이아웃** 단계다. ① 사진 질문과 ② 웹 방향의 답으로 아웃라인과 섹션별 배치표를 만든다.

${READ_COMMON(slug)}
- .claude/skills/travel-story/composition.md (아웃라인·템플릿·리듬·기록과 작품)
템플릿 목록과 필드는 \`npm run tf -- catalog\` 로 확인한다.

- ② 에서 고른 분량·작품 비중·톤을 지킨다. 사용자가 뺀 사진·사람 컷은 쓰지 않는다.
- interview.json 에 at="plan" 수정 요청이 있으면 그것을 반영한 새 배치표를 낸다.
- 문구는 아직 정하지 않는다 (초안을 본 뒤 보완 질문에서 묻는다).`;
}

// ── 4. ⑤ 보완 질문 ───────────────────────────────────────────

export function gapsPrompt(slug: string) {
  return `여행 "${slug}" 의 초안이 나왔다. **⑤ 보완 질문** 단계다.

${READ_COMMON(slug)}
- content/stories/${slug}/story.json (초안)

초안에서 \`memo\` 가 "보완:" 으로 시작하는 섹션, 비어 있는 캡션, 확인 안 된 사실을 보고 **꼭 필요한 것만** 묻는다.
- 질문마다 section 에 대상 섹션 id, header 에 섹션을 알아볼 짧은 이름, media 에 그 섹션의 사진을 넣는다.
- 선택지: 사실형 문장 / 사용자가 앞서 한 말을 다듬은 것(있을 때만) / "비워 두기". 사용자는 직접 쓸 수도 있다.
- 화면에 크게 보이는 곳(오프닝·하이라이트·마무리)부터. 최대 4문항.
- 물을 게 없으면 kind="done".`;
}

// ── 3. story.json 쓰기 · 고치기 ──────────────────────────────

export const WriteResult = z.object({
  title: z.string(),
  sections: z.number().int(),
  summary: z.string().max(300).describe('무엇을 만들었는지 사용자에게 보일 요약'),
});

export function writePrompt(slug: string) {
  return `여행 "${slug}" 의 **④ 초안**을 쓴다.

Read 로 읽는다: .claude/skills/travel-story/SKILL.md (6절), interview.md (④ 초안), composition.md,
work/${slug}/analysis.json, work/${slug}/interview.json (승인된 배치표는 at="plan" 의 승인 항목), work/${slug}/places.json (있으면).
\`npm run tf -- catalog\` 로 템플릿 필드를 확인한다.

content/stories/${slug}/story.json 을 쓴다. status 는 "draft".
- 승인된 배치표를 따른다.
- 문구: 사용자가 답한 것 → 그대로 / 확인된 장소·날짜·시각 → 사실형 / AI 문장은 ② 에서 허락한 범위만.
  모르는 감상·이름·가격은 비운다. 필수 필드라 비울 수 없으면 사실형으로 쓰고 그 섹션에
  "memo": "보완: <무엇이 필요한지>", "status": "needs_review" 를 단다. 나머지 섹션 status 는 "draft".
- map-journey 의 transport 는 사용자 답에서만.

쓴 뒤 \`npm run tf -- validate ${slug}\` 를 돌려 ✗ 오류를 모두 고친다
(media.json 이 아직 없다는 경고와 "media.json 에 없다" 오류는 다음 단계에서 해결되므로 무시해도 된다).`;
}

export function fixPrompt(slug: string, errors: string) {
  return `content/stories/${slug}/story.json 의 검증 오류를 고친다.
.claude/skills/travel-story/SKILL.md 와 composition.md 를 Read 로 읽고, 오류만 최소한으로 고친다.
approved 이거나 locked 인 섹션의 문구는 바꾸지 않는다.

오류:
${errors}

고친 뒤 \`npm run tf -- validate ${slug}\` 로 확인한다.`;
}

export const ReviseResult = z.object({
  changed: z.array(z.string()).describe('바꾼 섹션 id'),
  summary: z.string().max(300),
  skipped: z.array(z.string()).describe('못 바꾼 요청과 이유'),
});

export function revisePrompt(slug: string, requests: { section: string; text: string }[], answers: { section?: string; q: string; a: string }[]) {
  return `사용자가 폰에서 초안을 보고 답하고 요청했다. content/stories/${slug}/story.json 을 고친다 (④ 초안 다시 쓰기).
.claude/skills/travel-story/SKILL.md (수정 모드), interview.md (④·⑤), composition.md 를 Read 로 읽고 따른다.

${answers.length ? `보완 질문의 답:\n${answers.map((x) => `- [${x.section ?? '-'}] ${x.q} → ${x.a}`).join('\n')}\n` : ''}
${requests.length ? `섹션별 수정 요청:\n${requests.map((r) => `- [${r.section}] ${r.text}`).join('\n')}\n` : ''}
- 답을 반영한 섹션은 "보완:" memo 를 지우고, 그래도 비는 곳이 있으면 memo 에 남은 것을 적는다.
  "비워 두기" 답이면 그 캡션을 비우거나(선택 필드) 사실형으로 두고 memo 를 지운다.
- 요청받은 섹션만 고치고, 고친 섹션의 status 는 "draft" 로 둔다. approved 섹션의 문구는 요청이 없으면 그대로 둔다.
- locked 섹션은 건드리지 않는다 (skipped 에 이유를 적는다).
- 사진을 바꾸거나 늘려야 하면 work/${slug}/analysis.json 을 보고 고른다.
- 고친 뒤 \`npm run tf -- validate ${slug}\` 로 ✗ 오류가 없게 한다 ("media.json 에 없다" 는 다음 단계가 해결한다).`;
}
