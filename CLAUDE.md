# TaleFrame

여행 사진·영상으로 만든 인터랙티브 여행 후기 모음 사이트. 제품 설계는 `taleframe_design.md`.
**스토리는 Claude Code 스킬(`.claude/skills/travel-story`)이 만들고, 사이트는 보기 전용이다.** (앱 안 편집기·LLM 연동 없음)

## 구조

| 경로 | 역할 |
|---|---|
| `content/stories/<slug>/story.json` | 스토리 원본 — 스킬이 쓴다. 커밋한다 |
| `content/stories/<slug>/media.json` · `weather.json` | `tf media` / `tf weather` 가 생성. 손으로 쓰지 않는다. 커밋한다 |
| `work/<slug>/` | 스캔 결과·분석·인터뷰 답 (원본 경로·GPS 포함). **gitignore, 절대 배포하지 않는다** |
| `public/media/<slug>/` | 로컬 미리보기용 파생 파일. gitignore. 배포본은 같은 저장소의 `media` 브랜치 (커밋 1개) |
| `.media-repo/` | `tf upload` 가 `media` 브랜치를 다루는 작업 폴더. gitignore |
| `src/lib/story/schema.ts` | story.json / media.json zod 스키마 — 데이터 계약의 유일한 출처 |
| `src/lib/story/validate.ts` | 스키마로 안 잡히는 의미 검증 (CLI·빌드·테스트 공용) |
| `src/templates/catalog.ts` | 템플릿 메타데이터 (`tf catalog` 로 스킬에 노출) |
| `src/templates/registry.ts` | template id → React 컴포넌트. 여기 등록된 것만 렌더된다 |
| `src/templates/StoryRenderer.tsx` | 미리보기와 게시가 공유하는 단일 렌더러 |
| `scripts/tf.ts` | CLI: status · scan · places · plan · catalog · media · routes · weather · validate · upload · rename · schema |
| `scripts/lib/plan.ts` · `planMatch.ts` | travel-plan 계획 가져오기(읽기 전용 API) + 사진↔일정 매칭·질문 묶음 → `work/<slug>/plan*.json` |
| `content/redirects.json` | `tf rename` 이 남긴 옛 주소 → 새 주소. `postexport.mjs` 가 옛 주소에 넘김 페이지를 만든다 (Pages 는 서버 리다이렉트가 없다) |
| `scripts/postexport.mjs` | 빌드 뒤처리 — 공유 카드 `opengraph-image` 에 .png 를 붙인다 (Pages 의 Content-Type 때문) |
| `.github/workflows/pages.yml` | main 푸시 → media 브랜치 체크아웃 → 검사 → 정적 내보내기 → GitHub Pages |
| `scripts/shot.ts` | Playwright 스크롤 스크린샷 + 자동 검사(콘솔 오류·깨진 이미지·가로 넘침). `shot -- lab` 은 실험실 |
| `src/templates/art.tsx` | 작품 템플릿 8종 (verse · color-field · film-roll · diptych · spotlight · riso-print · kinetic-type · palette-diary) |
| `src/templates/keepsake.tsx` | 기록물 5종 (stamp-rally · transit-ticket · day-clock · contact-sheet · photo-map) |
| `src/templates/paper.tsx` | 종이 위의 것들 6종 (postcard-back · receipt · walk-line · split-flap · photo-stack · scrap-object) |
| `src/lib/lab.ts` · `/lab` | 템플릿 실험실 — 실제 스토리의 미디어로 모든 템플릿을 한 페이지에 (개발 전용). `/lab/<slug>` 로 사진 출처, `?t=a,b` 로 템플릿을 고른다 |
| `studio/` | **TaleFrame Studio** — 폰(집 와이파이)에서 업로드·질문 답변·미리보기 승인·게시. Hono 서버, `npm run studio -- --lan` |
| `studio/prompts.ts` | headless 단계별 지시 + 응답 zod 스키마. 판단 규칙은 스킬 문서를 Read 하게 할 뿐 여기 다시 쓰지 않는다 |

## 새 템플릿 추가 순서

1. `schema.ts` 의 `sectionSchemas` 에 strict 스키마 추가
2. `catalog.ts` 에 메타데이터, `mediaRefs()` 에 미디어 참조 추가
3. 컴포넌트 작성 후 `registry.ts` 에 등록 (타입이 누락을 잡는다)
4. `tests/fixtures/showcase.ts` 와 `src/lib/lab.ts` 의 `labSection()` 에 예시 추가 — 테스트가 둘 다 "모든 템플릿"을 강제한다
5. `npm run tf -- schema` 로 `content/story.schema.json` 갱신
6. **dev 서버를 재시작**하고 `npm run shot -- lab` 으로 데스크톱·모바일 시트를 직접 본다.
   실제 화면으로 확인하기 전에는 스토리에 쓰지 않는다 (지난번 11종이 테스트만 통과한 채 남아 있었다)

## Studio (폰에서 만들기)

- 흐름은 interview.md 의 다섯 단계: **① 사진 질문 → ② 웹 방향 → ③ 레이아웃 승인 → ④ 초안 확인 → ⑤ 보완 질문**(④⑤ 반복).
  문구를 다 받고 쓰지 않는다 — 빈칸 있는 초안을 먼저 보여주고 빈 곳만 묻는다. 단계는 서버가 파일로 정하고
  (`studio/phases.json`·`next.json`·`gaps.json`), Claude 에게는 그 단계 프롬프트만 준다.
- 스킬(대화형)과 studio(폰)는 **같은 규칙 파일**(`.claude/skills/travel-story/*.md`)을 읽는다. 규칙은 거기만 고친다.
- headless 호출은 `studio/agent.ts` 한 곳: `--json-schema` 의 `structured_output` 만 믿는다(본문 파싱 금지),
  `--strict-mcp-config --disable-slash-commands --tools …` 로 가볍게 (실측 $0.34 → $0.07~0.09/호출),
  쓰기는 `work/<slug>/**`·`content/stories/<slug>/**`, Bash 는 `npm run tf` 만. **git push·게시는 서버 코드만** 한다.
  출력은 `stream-json --include-partial-messages` 로 받아 지금 하는 일(읽는 파일·답 쓰는 글자 수)을 폰에 흘린다.
  진행 막대는 그 단계가 지난번 걸린 시간(`.studio/durations.json`, 최근 5회 중앙값) 기준, 처음이면 오가는 막대.
- 상태는 전부 파일 (`work/<slug>/studio/{meta,job,next,preview,published}.json` + 기존 inventory/analysis/interview).
  작업은 한 번에 하나 (`studio/jobs.ts`). `tf` 명령은 하위 프로세스로 부른다 (`fail()` 이 서버를 죽이지 않게).
- 보안: 루프백 또는 사설망 주소만, 이 PC 가 아니면 토큰 쿠키(QR `?k=`). 방화벽은 `scripts/studio-lan.sh`(개인 네트워크 전용).
- 바탕 화면 실행: `scripts/studio-desktop.sh` 가 `TaleFrame Studio.cmd` 를 만든다 → `wsl.exe … bash -lc scripts/studio-start.sh`.
  **로그인 셸이어야** `~/.local/bin/claude` 가 PATH 에 들어온다. .ps1 은 더블클릭하면 메모장이 열려서 .cmd 다.
- 미리보기는 `NEXT_PUBLIC_BASE_PATH=/preview TALEFRAME_SHOW_DRAFTS=1 npm run build` 의 `out/` 을 studio 가 `/preview/` 로 낸다.
  최신 여부는 파일 시각이 아니라 **story.json 내용 지문(status 제외)** 으로 본다 — 승인만으로 초안이 다시 만들어지지 않게.
- Next 빌드는 `tsconfig.next.json`(src/ 만)으로 타입 검사한다 — studio·tests 의 오류가 미리보기·배포를 막지 않게 (실제로 막혔다).

## travel-plan 연동 (여행 계획 → 질문 줄이기)

- 사용자가 travel-plan(여행 플래너 앱, 같은 사용자의 다른 프로젝트)에 적은 일정·항공편·숙소를 **읽기 전용 내보내기 API**
  (`<travel-plan>/api/export/trips?from&to` · `/trips/<id>`, Bearer 토큰)로 받는다. DB 키는 갖지 않는다.
  설정은 `.env.local`(gitignore): `TRAVEL_PLAN_URL` · `TRAVEL_PLAN_TOKEN`. 없으면 `tf plan`·Studio 가 건너뛰고 예전처럼 묻는다.
- **스토리를 만들 때 이 PC 에서만** 부른다 — 빌드·Actions·브라우저에서는 절대 부르지 않는다. 결과는 `work/<slug>/` 에만.
- 매칭은 travel-video-maker `plan.py` 를 옮긴 것 + 다카마쓰 259장 실측으로 고친 것: 시각상 바로 앞뒤(60분) 일정의 장소면
  어긋남이 아니라 "좌표로 확인", 이동 일정은 출발지·도착지 둘 다 그 일정의 장소. (고치기 전 어긋남 74장 → 13장, 질문 4묶음)
- 질문은 사진 단위가 아니라 `plan-questions.json` 의 **confirm(일괄 확인 1번) · ask(어긋남 묶음마다 1개)**. Studio 프롬프트는
  이 작은 요약만 읽게 한다 — 사진별 매칭 전체를 읽히면 headless 한 번이 $1 을 넘었다.
- 계획은 사용자가 적은 자료지만 **확인(일괄) 전에는 짐작과 같다** (interview.md ①). 계획 시각을 잘못 적은 일정이 실제로 있다.

## 이번에 걸린 함정

- **스크롤 애니메이션의 입력 구간은 0~1 안에서 증가해야 한다.** Motion 이 스크롤 연동을 WAAPI 로 넘길 때 음수나 1 초과,
  겹친 오프셋이 있으면 "Offsets must be monotonically non-decreasing" 로 **페이지 렌더가 통째로 멈춘다** (그 뒤 섹션이 다 사라짐).
- **스키마(`sectionSchemas`)를 바꾸면 dev 서버를 재시작한다.** Turbopack HMR 이 바뀐 스키마를 반영하지 못해 새 템플릿이 조용히 빠진다.
- MapLibre 6 워커는 번들되지 않는다 → `scripts/copy-vendor.mjs` + `setWorkerUrl` (predev/prebuild).
- Satori(OG 이미지)는 `inset` 을 모른다 — top/left/width/height 를 직접 준다.
- 눈·비 같은 잔 디테일 영상은 CRF 만으로 15Mbps 를 넘는다 → `-maxrate`. 파생 규칙을 바꾸면 `DERIVE_VERSION` 을 올린다.
- 색면 배경은 DarkMuted 부터 고르면 사진마다 같은 갈색이 된다 → DarkVibrant 우선.
- **SSR 하는 클라이언트 컴포넌트에 삼각함수 결과를 그대로 넣지 않는다.** 서버·브라우저의 부동소수 끝자리가 달라
  하이드레이션이 어긋났다 (손그림 경로·다이얼 좌표·도장 각도) → 소수 2~3자리로 반올림. 화면 비율 같은 브라우저 값도 첫 렌더에 넣지 않는다.
- SVG `pathLength` 애니메이션에 `vector-effect: non-scaling-stroke` 를 같이 쓰면 큰 화면에서 선이 반만 그려진다.

## 규칙

- 타입 있는 데이터 + 스키마 검증. 등록된 컴포넌트만 렌더한다. LLM 이 만든 HTML/JS 를 실행하지 않는다.
- AI 는 감정·사실·가격·장소·사건을 지어내지 않는다. 불확실하면 묻는다. 승인(`approved`)·잠금(`locked`) 섹션을 보존한다.
- 공개 사이트다: 파생 파일은 EXIF/GPS 제거(sharp 기본 + ffmpeg `-map_metadata -1`, 출력 후 ffprobe 로 재검사). 집 좌표 금지 — **숙소 위치는 공개해도 된다**(사용자 결정 2026-10-26).
- 파생 형식(실측 근거는 커밋 메시지·프로젝트 문서): 사진은 AVIF q62 + 가장 작은 폭 WebP 대체본, 일반 영상 H.264 CRF 28
  (상한 10Mbps), 스크럽 H.264 키프레임 4간격. 파일 하나 95MiB 초과 시 실패 (GitHub 100MiB 한도).
- 자산 URL 은 반드시 `basePath`(`src/lib/media.ts`)를 붙인다 — Pages 는 `/<repo>/` 아래에 열린다. next/link 는 자동.
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

- **GitHub Pages** (Vercel·Supabase 를 쓰지 않는다 — 사용자 결정 2026-10-16).
  게시 순서: `tf upload <slug>`(media 브랜치 강제 푸시) → story.json 등을 main 에 커밋·푸시 → `pages.yml` 이 배포.
  워크플로는 게시 스토리의 파일이 media 브랜치에 다 있는지(`validate --strict-media`)와 사이트 1GB 상한을 검사한다.
  `tf upload` 는 content/stories/ 에 없는 스토리 폴더를 media 브랜치에서 지운다 (주소 변경·삭제 정리).
- 주소(slug)는 게시 링크다. 바꿀 때는 `tf rename <옛> <새>` → `tf upload <새>` → 커밋·푸시. Studio 는 새 여행을 만들 때 영문 주소를 따로 받는다.
- 로컬에서 Pages 와 같은 조건 확인: `NEXT_PUBLIC_BASE_PATH=/taleframe TALEFRAME_SHOW_DRAFTS=1 npm run build` 후
  `out/` 을 `/taleframe/` 아래로 서빙하고 `npm run shot -- <slug> --url http://127.0.0.1:<port>/taleframe`.
- 지도 타일: OpenFreeMap (키 없음) / 장소 후보: Nominatim (초당 1회, 스킬 전용) / 날씨: Open-Meteo (CC BY 4.0, 표기 필수)
- 프로젝트 문서: `~/.claude/docs/projects/taleframe.md`
