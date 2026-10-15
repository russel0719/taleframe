# TaleFrame

사진과 영상으로 엮은 인터랙티브 여행 후기 모음 사이트.
여행마다 같은 디자인 시스템을 쓰되, 26종의 템플릿을 이야기에 맞게 조합해 서로 다른 구조와 리듬을 만든다.

스토리는 Claude Code 의 `travel-story` 스킬로 추가한다 — 폴더를 주면 사진을 훑어보고, 필요한 것만 묻고,
구성과 템플릿을 제안한 뒤 페이지를 만든다. 사이트 자체는 보기 전용이다.

## 스택

- Next.js 16 (App Router, 정적 생성) + TypeScript + Tailwind CSS 4 + Zod 4
- 인터랙션: Motion · MapLibre GL(react-map-gl) + OpenFreeMap · Turf · yet-another-react-lightbox · react-photo-album ·
  Embla Carousel · react-compare-slider · Photo Sphere Viewer · Howler
- 미디어 처리(로컬 CLI): sharp · thumbhash · node-vibrant · exifr · ffmpeg
- 데이터: Open-Meteo(날씨) · Nominatim(장소 후보)
- 배포: Vercel / 미디어: Supabase Storage(공용 프로젝트, 버킷 `taleframe`)

## 사용

```bash
npm install
cp .env.example .env.local      # 업로드할 때만 필요
npm run dev                     # http://localhost:3000
```

Claude Code 에서: `"~/Pictures/2026 오사카 폴더로 여행 후기 만들어줘"` → travel-story 스킬

CLI 를 직접 쓸 때는 `scripts/tf.ts` 상단의 사용법을 본다. 시스템에 `ffmpeg`/`ffprobe` 가 있어야 한다.

## 검사

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## 문서

- 제품 설계: `taleframe_design.md`
- 개발 규칙: `CLAUDE.md`
- 프로젝트 문서(스택·배포·Supabase): `~/.claude/docs/projects/taleframe.md`
