# TaleFrame

여행 사진·영상으로 만든 인터랙티브 여행 후기 모음 사이트. 제품 설계는 `taleframe_design.md`.
**스토리는 Claude Code 스킬(`.claude/skills/travel-story`)이 만들고, 사이트는 보기 전용이다.** (앱 안 편집기·LLM 연동 없음)

## 구조

| 경로 | 역할 |
|---|---|
| `content/stories/<slug>/story.json` | 스토리 원본 — 스킬이 쓴다. 커밋한다 |
| `content/stories/<slug>/media.json` · `weather.json` | `tf media` / `tf weather` 가 생성. 손으로 쓰지 않는다. 커밋한다 |
| `work/<slug>/` | 스캔 결과·분석·인터뷰 답 (원본 경로·GPS 포함). **gitignore, 절대 배포하지 않는다** |
| `public/media/<slug>/` | 로컬 미리보기용 파생 파일. gitignore. 배포본은 Supabase Storage `taleframe` 버킷 |
| `src/lib/story/schema.ts` | story.json / media.json zod 스키마 — 데이터 계약의 유일한 출처 |
| `src/lib/story/validate.ts` | 스키마로 안 잡히는 의미 검증 (CLI·빌드·테스트 공용) |
| `src/templates/catalog.ts` | 템플릿 메타데이터 (`tf catalog` 로 스킬에 노출) |
| `src/templates/registry.ts` | template id → React 컴포넌트. 여기 등록된 것만 렌더된다 |
| `src/templates/StoryRenderer.tsx` | 미리보기와 게시가 공유하는 단일 렌더러 |
| `scripts/tf.ts` | CLI: status · scan · places · catalog · media · routes · weather · validate · upload · schema |
| `scripts/shot.ts` | Playwright 스크롤 스크린샷 + 자동 검사(콘솔 오류·깨진 이미지·가로 넘침). `shot -- lab` 은 실험실 |
| `src/templates/art.tsx` | 작품 템플릿 7종 (verse · color-field · film-roll · diptych · spotlight · riso-print · kinetic-type) |
| `src/lib/lab.ts` · `/lab` | 템플릿 실험실 — 실제 스토리의 미디어로 모든 템플릿을 한 페이지에 (개발 전용) |

## 새 템플릿 추가 순서

1. `schema.ts` 의 `sectionSchemas` 에 strict 스키마 추가
2. `catalog.ts` 에 메타데이터, `mediaRefs()` 에 미디어 참조 추가
3. 컴포넌트 작성 후 `registry.ts` 에 등록 (타입이 누락을 잡는다)
4. `tests/fixtures/showcase.ts` 와 `src/lib/lab.ts` 의 `labSection()` 에 예시 추가 — 테스트가 둘 다 "모든 템플릿"을 강제한다
5. `npm run tf -- schema` 로 `content/story.schema.json` 갱신
6. **dev 서버를 재시작**하고 `npm run shot -- lab` 으로 데스크톱·모바일 시트를 직접 본다.
   실제 화면으로 확인하기 전에는 스토리에 쓰지 않는다 (지난번 11종이 테스트만 통과한 채 남아 있었다)

## 이번에 걸린 함정

- **스크롤 애니메이션의 입력 구간은 0~1 안에서 증가해야 한다.** Motion 이 스크롤 연동을 WAAPI 로 넘길 때 음수나 1 초과,
  겹친 오프셋이 있으면 "Offsets must be monotonically non-decreasing" 로 **페이지 렌더가 통째로 멈춘다** (그 뒤 섹션이 다 사라짐).
- **스키마(`sectionSchemas`)를 바꾸면 dev 서버를 재시작한다.** Turbopack HMR 이 바뀐 스키마를 반영하지 못해 새 템플릿이 조용히 빠진다.
- MapLibre 6 워커는 번들되지 않는다 → `scripts/copy-vendor.mjs` + `setWorkerUrl` (predev/prebuild).
- Satori(OG 이미지)는 `inset` 을 모른다 — top/left/width/height 를 직접 준다.
- 눈·비 같은 잔 디테일 영상은 CRF 만으로 15Mbps 를 넘는다 → `-maxrate`. 파생 규칙을 바꾸면 `DERIVE_VERSION` 을 올린다.
- 색면 배경은 DarkMuted 부터 고르면 사진마다 같은 갈색이 된다 → DarkVibrant 우선.

## 규칙

- 타입 있는 데이터 + 스키마 검증. 등록된 컴포넌트만 렌더한다. LLM 이 만든 HTML/JS 를 실행하지 않는다.
- AI 는 감정·사실·가격·장소·사건을 지어내지 않는다. 불확실하면 묻는다. 승인(`approved`)·잠금(`locked`) 섹션을 보존한다.
- 공개 사이트다: 파생 파일은 EXIF/GPS 제거(sharp 기본 + ffmpeg `-map_metadata -1`, 출력 후 ffprobe 로 재검사). 숙소 좌표 금지.
- 반응형 + `prefers-reduced-motion` 존중 (모든 스크롤 장면에 정적 대체가 있다). 무거운 위젯(지도·파노라마·라이트박스)은 화면 근처에서만 로드.
- 디자인 토큰은 `src/app/globals.css` 한곳 (`~/.claude/design.md` 값). 디자인 방향은 미정 — 바꿀 때 이 파일 위주로.
  작품 섹션만 예외적으로 명조(`font-serif`, Noto Serif KR)·잡음 질감·사진 팔레트 색을 쓴다 (프로젝트 문서에 편차 기록).
- 새 기능에는 테스트를 붙이고 `npm run typecheck && npm run lint && npm test && npm run build` 를 돌린다. 실제로 돌린 것과 결과를 그대로 보고한다.

## 명령

```bash
npm run dev            # 초안 포함 미리보기 (프로덕션 빌드는 published 만)
npm run tf -- <cmd>    # scripts/tf.ts 상단 사용법
npm run shot -- <slug> # 스크린샷 (dev 서버 필요)
npm test               # vitest
```

## 배포 / 외부 서비스

- Vercel: main 푸시 → 정적 빌드. 환경변수 `NEXT_PUBLIC_SUPABASE_URL` 이 있으면 프로덕션은 Storage URL 을 쓴다.
- Supabase: 공용 프로젝트의 Storage 버킷 `taleframe` 만 사용 (DB 테이블 없음). 마이그레이션 `supabase/migrations/`.
  공용 DB 이므로 `supabase migration repair --status reverted` 는 절대 실행하지 않는다 (`~/.claude/CLAUDE.md` 3.2).
- 지도 타일: OpenFreeMap (키 없음) / 장소 후보: Nominatim (초당 1회, 스킬 전용) / 날씨: Open-Meteo (CC BY 4.0, 표기 필수)
- 프로젝트 문서: `~/.claude/docs/projects/taleframe.md`
