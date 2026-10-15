---
name: travel-story
description: 여행 사진·영상 폴더로 TaleFrame 사이트에 인터랙티브 여행 후기 페이지를 추가하거나, 이미 있는 후기를 고친다. 폴더를 훑어 장면을 파악하고, 사용자에게 필요한 것만 물어 이야기 구조와 템플릿 배치를 정한 뒤, story.json 작성 → 웹용 변환 → 검증 → 미리보기 → (승인 시) 업로드까지 진행한다. 사용자가 "여행 후기 추가", "이 폴더로 여행 페이지 만들어줘", "스토리 만들어줘", "TaleFrame 에 올려줘", 기존 후기의 문장/순서/템플릿 수정을 요청할 때 쓴다.
---

# 여행 후기 페이지 만들기 (TaleFrame)

저장소: `~/workspace/taleframe` — 모든 명령은 이 디렉토리에서 실행한다.

역할 분담이 이 스킬의 핵심이다. **기계적인 일은 전부 CLI(`npm run tf -- …`)가 한다** — 스캔, 썸네일,
장소 후보 조회, 웹용 변환, EXIF/GPS 제거, 날씨 조회, 검증, 업로드. **판단만 네가 한다** — 어떤 컷을 쓸지,
어떤 이야기 순서로 놓을지, 섹션마다 어떤 템플릿을 쓸지, 사용자에게 무엇을 물을지.

네가 직접 쓰는 파일은 `content/stories/<slug>/story.json` 하나뿐이다.
`media.json` · `weather.json` 은 CLI 가 만든다. 손으로 쓰지 마라.

## 절대 규칙

1. **지어내지 않는다.** 감정, 사건, 가게 이름, 가격, 지명, 동행과의 관계 — 사용자가 말했거나 확인한 것만 쓴다.
   사진만 보고 짐작한 것은 질문의 선택지로만 쓴다. 모르면 비워 둔다. 자막 없는 컷이 기본이다.
2. **이 사이트는 완전 공개다.** 숙소·집 좌표는 어디에도 넣지 않는다. 일행이 아닌 사람의 얼굴이 크게 나온 컷,
   일행 얼굴이 나온 컷은 넣기 전에 사용자에게 묻는다. 업로드 전에 반드시 "공개된다"는 사실을 확인받는다.
3. **승인·잠금을 지킨다.** `status: "approved"` 섹션의 문구는 사용자 동의 없이 바꾸지 않고,
   `locked: true` 섹션은 아예 건드리지 않는다. 고칠 때는 바뀌는 부분을 전/후로 보여주고 승인받는다.
4. **모든 여행을 같은 틀에 넣지 않는다.** 템플릿은 이야기에 맞춰 고른다 — 지도나 음식 템플릿이 없어도 된다.

---

## 0. 준비

- slug: 영문 kebab-case, 장소-연월 (`osaka-kyoto-2026-02`). 사용자가 다르게 원하면 따른다.
- `content/stories/<slug>/story.json` 이 이미 있으면 **수정 모드**(맨 아래)로 간다.
- `work/<slug>/` 에 이전 작업이 남아 있으면 이어서 한다 (아래 "중간에 끊겼을 때").

## 1. 스캔

```bash
npm run tf -- scan "<폴더>" --slug <slug>
```

`work/<slug>/inventory.json`(원본 경로·시각·GPS — 공개되지 않는다), 512px 썸네일,
12장씩 묶은 **밀착 인화지**(`work/<slug>/sheets/sheet-NN.jpg`)가 생긴다. 출력에서 날짜 경계, 영상 길이, 건너뛴 파일을 본다.

## 2. 훑어보기

**밀착 인화지를 한 장씩 Read 하고, 한 장 볼 때마다 결과를 `work/<slug>/analysis.json` 에 바로 덧붙인다.**
디스크에 쓰고 나면 그 이미지는 컨텍스트에서 놓아도 된다. 자세히 봐야 하는 컷만 `work/<slug>/thumbs/<id>.jpg` 를 연다
(영상은 `<id>_a/_b/_c.jpg` = 10% · 50% · 85% 지점).

```json
{"id": "m007", "scene": "주홍색 누문과 돌계단, 흐린 하늘", "category": "landscape",
 "people": "멀리 관광객", "faces": false, "score": 4, "guess": "후시미 이나리?", "note": "구도 좋음"}
```

- `category`: landscape · food · street · indoor · transport · people · lodging · other
- `score` 1~5: 이야기에 쓸 가치. 흔들림·중복·스크린샷은 낮게.
- `faces`: 얼굴이 알아볼 만큼 크게 나오면 true — 공개 여부 질문 대상.
- `guess` 는 짐작이다. 물음표를 붙여 두고 사실처럼 옮기지 마라.
- 다른 도구가 만든 결과물(렌더된 mp4, 편집본)이나 중복 컷은 `"exclude": "이유"` 로 표시하고 인터뷰에서 확인한다.

## 3. 장소 후보 (GPS 가 있을 때)

```bash
npm run tf -- places <slug>
```

촬영 지점을 묶고 OpenStreetMap 으로 이름 **후보**를 붙인다 (`work/<slug>/places.json`). 초당 1회라 지점 수만큼 초가 걸린다.
결과는 인터뷰 선택지의 재료다. 좌표를 스토리에 넣을 때는 소수점 3자리(약 100m)로 줄인다.

## 4. 인터뷰

**`interview.md`(이 스킬 폴더)를 Read 로 읽고 그대로 따른다.** 라운드 구성, 선택지 만드는 법, 금지 사항이 거기 있다.
답을 받을 때마다 `work/<slug>/interview.json` 에 바로 기록한다.

## 5. 구성 — 아웃라인과 템플릿

**`composition.md`(이 스킬 폴더)를 Read 로 읽고 따른다.** 그리고 템플릿 목록은 항상 CLI 로 본다:

```bash
npm run tf -- catalog
```

카탈로그가 템플릿의 유일한 출처다 (필드, 글자 수 제한, 어울리는 경우/피할 경우). 여기에 다시 적지 않는다.

순서: ① 챕터 아웃라인을 표로 제안 → 승인 ② 섹션별 템플릿 배치를 이유·대안과 함께 표로 제안 → 승인
③ 자막·문구를 섹션마다 확인 (interview.md 의 "문구 라운드").

## 6. story.json 쓰기

```json
{
  "$schema": "../../story.schema.json",
  "version": 1,
  "slug": "osaka-kyoto-2026-02",
  "status": "draft",
  "title": "…", "summary": "…",
  "trip": { "start": "2026-02-06", "end": "2026-02-09", "places": ["오사카", "교토"] },
  "cover": "m007",
  "media": { "m007": { "alt": "주홍색 누문과 돌계단" }, "m012": { "trim": { "start": 2, "end": 11 } } },
  "updatedAt": "2026-10-15",
  "sections": [
    { "id": "opening", "template": "hero-fullbleed", "status": "draft", "media": "m007", "title": "…" }
  ]
}
```

- 섹션 `status`: 사용자가 확인한 문구만 있으면 `draft`, 확인 안 된 사실이 섞였으면 `needs_review`(+ `memo` 에 무엇이 미확인인지).
  미리보기를 보고 사용자가 승인하면 그때 `approved`.
- `alt` 는 쓰는 사진마다 단다. **보이는 것만** 묘사한다 ("붉은 도리이가 늘어선 산길"). 확인된 지명만 넣는다.
- 섹션 `id` 는 의미 있는 kebab-case 로 (`day2-fushimi`). 수정할 때도 바꾸지 않는다.
- 영상이 길면 `media.<id>.trim` 으로 자른다. 스크럽 영상은 15초 안쪽이 좋다.
- `ambient` (현장음): 소리가 좋은 영상 id 를 섹션에 주면 그 섹션부터 깔린다. 사용자에게 소리를 들려줄 수 없으니
  영상 설명과 함께 "이 소리를 배경으로 깔까요?" 라고 묻는다. 기본은 넣지 않는다.

## 7. 변환 · 날씨 · 검증

```bash
npm run tf -- media <slug>      # story.json 이 쓰는 미디어만 webp/mp4/m4a 로. EXIF·GPS 제거, 위치 태그 남으면 실패
npm run tf -- weather <slug>    # weather-card 가 있을 때만 (Open-Meteo)
npm run tf -- routes <slug>     # map-journey 가 있을 때만 — 구간마다 실제 길을 따라가는 경로 (OSRM)
npm run tf -- validate <slug>
```

`✗` 는 전부 고친다. `·` 경고도 하나씩 읽고, 의도한 게 아니면 고친다 (같은 템플릿 연속, 긴 장면 연속, alt 누락 등).
`npm run tf -- media` 는 이미 만든 파일은 건너뛰므로 다시 돌려도 싸다.

`routes` 는 각 장소의 `transport` 로 길찾기 방식을 정하고(walk→보행로, taxi/bus/car→도로, bike→자전거길),
두 장소 사이에 찍은 사진의 GPS 를 경유지로 넣는다. 그래서 **transport 는 반드시 사용자에게 묻는다** (모르면 비워 두면 점선 직선).
기차·지하철·비행기·배는 도로로 그리면 거짓이 되므로 점선 직선이다. 출력의 경유지 목록에 숙소 근처 지점이 끼어 있지 않은지 확인한다.

## 8. 미리보기

```bash
npm run dev     # 백그라운드로. 이미 떠 있으면 그대로 쓴다
npm run shot -- <slug>          # 데스크톱·모바일 전체 화면 스크린샷 → work/<slug>/shots/
```

**스크린샷을 직접 Read 해서 먼저 점검한다** — 자막이 사진을 가리는지, 크롭이 피사체를 잘랐는지(→ `media.<id>.focus` 조정),
빈 섹션이 있는지. 고친 뒤 사용자에게 `http://localhost:3000/stories/<slug>` 를 열어보라고 하고
(모바일은 개발자 도구 기기 모드), 섹션 표와 함께 승인/수정 요청을 받는다.

## 9. 게시

사용자가 승인하면:

1. 승인된 섹션을 `approved` 로, 스토리 `status` 를 `published` 로 바꾸고 `validate` 를 다시 돌린다
   (published 인데 승인 안 된 섹션이 있으면 오류가 난다 — 의도된 안전장치다).
2. **업로드 전에 확인받는다**: "사진 N장·영상 M개가 공개 버킷에 올라가 링크를 아는 누구나 볼 수 있게 됩니다. 진행할까요?"
3. `npm run tf -- upload <slug>` → `npm run tf -- validate <slug> --remote` (원격에서 실제로 받아지는지)
4. 커밋할 파일: `content/stories/<slug>/` (story.json · media.json · weather.json). `work/` 와 `public/media/` 는
   gitignore 라 커밋되지 않는다. 커밋·푸시는 사용자에게 묻고 한다. main 에 푸시하면 Vercel 이 배포한다.

---

## 수정 모드 (이미 있는 스토리)

1. `story.json` 을 읽고 `npm run tf -- validate <slug>` 로 현재 상태 표를 본다.
2. 요청을 섹션 단위 변경 목록으로 바꾼다. `locked` 섹션이 걸리면 손대지 말고 사용자에게 알린다.
   `approved` 섹션 문구를 바꿔야 하면 전/후를 보여주고 승인받는다.
3. 사진을 새로 넣어야 하면 같은 폴더를 다시 `scan` 한다 — 기존 id 는 유지되고 새 파일만 새 id 를 받는다.
   `work/<slug>/` 가 없으면 (다른 기기 등) 원본 폴더 경로를 물어 다시 스캔한다.
4. 고친 섹션은 다시 `draft` 로 두고 7~9 단계를 반복한다. 게시된 스토리라면 업로드까지 해야 반영된다.

## 중간에 끊겼을 때

`work/<slug>/` 의 파일로 어디까지 했는지 안다:
`inventory.json`(스캔 끝) → `analysis.json`(어디까지 봤는지) → `interview.json`(받은 답) → `story.json` → `media.json`.
이미 있는 단계는 다시 하지 않는다. 분석과 답은 단계마다 바로 디스크에 써 두었으므로 이어서 하면 된다.

## 자주 걸리는 것

| 증상 | 원인 | 대응 |
|---|---|---|
| scan 이 HEIC 를 건너뜀 | sharp 가 HEIC 를 못 읽음 | 사용자에게 JPEG 로 내보내 달라고 하고 다시 scan |
| 시각 순서가 이상함 | 기기 시계가 출발지 시간대 | 아웃라인을 시간보다 장소 기준으로 짠다. 사용자에게 확인 |
| media 가 "메타데이터가 남았다"로 실패 | 영상 위치 태그 제거 실패 | 그 영상은 빼고 진행, 사용자에게 알린다. 절대 우회하지 않는다 |
| validate: 같은 템플릿 연속 | 리듬 단조 | composition.md 의 리듬 규칙대로 사이에 다른 섹션을 둔다 |
| 피사체가 잘림 | 자동 중심점이 빗나감 | `media.<id>.focus: [x, y]` (0~1) 지정 |
| weather 가 "기록이 아직 없다" | 최근 며칠은 집계 전 | 며칠 뒤 다시, 또는 섹션을 뺀다 |
| upload 가 버킷 없음 | 마이그레이션 미적용 | `supabase/migrations/*_taleframe_storage_bucket.sql` 적용 필요 — 사용자에게 알린다 |
