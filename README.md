# TaleFrame

사진과 영상으로 엮은 인터랙티브 여행 후기 모음 사이트.

**사이트: https://russel0719.github.io/taleframe/**

| 스토리 | 주소 |
|---|---|
| 오사카 · 교토 | https://russel0719.github.io/taleframe/stories/osaka-2026/ |
| 다카마쓰 · 나오시마 | https://russel0719.github.io/taleframe/stories/takamatsu-2026/ |

여행마다 같은 디자인 시스템을 쓰되, 33종의 템플릿(기록 26 + 작품 7)을 이야기에 맞게 조합해 서로 다른 구조와 리듬을 만든다.

스토리는 Claude Code 의 `travel-story` 스킬로 추가한다 — 폴더를 주면 사진을 훑어보고, 필요한 것만 묻고,
구성과 템플릿을 제안한 뒤 페이지를 만든다. 사이트 자체는 보기 전용이다.

## 스택

- Next.js 16 (App Router, 정적 생성) + TypeScript + Tailwind CSS 4 + Zod 4
- 인터랙션: Motion · MapLibre GL(react-map-gl) + OpenFreeMap · Turf · yet-another-react-lightbox · react-photo-album ·
  Embla Carousel · react-compare-slider · Photo Sphere Viewer · Howler
- 미디어 처리(로컬 CLI): sharp · thumbhash · node-vibrant · exifr · ffmpeg
- 데이터: Open-Meteo(날씨) · Nominatim(장소 후보) · OSRM(경로)
- 배포: GitHub Pages (정적 내보내기). 사진·영상은 같은 저장소의 `media` 브랜치(커밋 1개)에서 함께 배포된다

## 사용

```bash
npm install
npm run dev                     # http://localhost:3000 (/lab 은 템플릿 실험실)
```

Claude Code 에서: `"~/Pictures/2026 오사카 폴더로 여행 후기 만들어줘"` → travel-story 스킬

폰(집 와이파이)에서: `npm run studio -- --lan` → 터미널 QR 을 찍고, 사진 올리기 → 질문 답하기 → 미리보기 승인 → 게시.
처음 한 번 `scripts/studio-lan.sh` 로 Windows 방화벽(개인 네트워크 전용)을 연다.
`scripts/studio-desktop.sh` 를 한 번 돌리면 Windows 바탕 화면에 `TaleFrame Studio.cmd` 가 생긴다 — 더블클릭하면 창에 QR 이 뜨고, 창을 닫으면 꺼진다.

스토리 주소를 바꾸려면 `npm run tf -- rename <옛> <새>` → `tf upload <새>` → 커밋·푸시 (옛 주소는 새 주소로 넘겨 준다).

CLI 를 직접 쓸 때는 `scripts/tf.ts` 상단의 사용법을 본다. 시스템에 `ffmpeg`/`ffprobe` 가 있어야 한다.

## 검사

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## 문서

- 제품 설계: `taleframe_design.md`
- 개발 규칙: `CLAUDE.md`
- 프로젝트 문서(스택·배포·용량 실측): `~/.claude/docs/projects/taleframe.md`
