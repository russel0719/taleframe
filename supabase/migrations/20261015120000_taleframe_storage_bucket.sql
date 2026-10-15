-- TaleFrame 미디어 버킷.
-- 웹용 파생 파일(webp/mp4/m4a/jpg)만 올라간다. 원본과 EXIF·GPS 는 올라가지 않는다 (scripts/lib/derive.ts).
--
-- public 버킷: 읽기는 /storage/v1/object/public/taleframe/... 로 누구나 가능 (사이트가 완전 공개이므로 의도된 것).
-- 쓰기 정책은 일부러 만들지 않는다 — anon/authenticated 는 쓸 수 없고, 업로드는 서비스 롤 키
-- (RLS 우회)를 쓰는 로컬 CLI `npm run tf -- upload` 만 한다.
--
-- DB 테이블은 없다. 스토리 데이터는 저장소의 content/stories/*/story.json 이 원본이다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'taleframe',
  'taleframe',
  true,
  52428800, -- 50MB
  array['image/webp', 'image/jpeg', 'video/mp4', 'audio/mp4']
)
on conflict (id) do nothing;
