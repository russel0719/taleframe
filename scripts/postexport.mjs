// 정적 내보내기 뒤처리 (npm postbuild).
// Next 는 공유 카드를 확장자 없는 `opengraph-image` 파일로 내보내는데, GitHub Pages 는 확장자로
// Content-Type 을 정하므로 application/octet-stream 이 되어 카카오톡·페이스북이 카드 이미지를 못 읽는다.
// → 파일에 .png 를 붙이고 HTML·RSC 페이로드의 참조도 같이 고친다.
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(import.meta.dirname, '..', 'out');
if (!fs.existsSync(out)) process.exit(0);

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'media' && e.name !== '_next') walk(p);
    } else files.push(p);
  }
};
walk(out);

let renamed = 0;
for (const f of files) {
  if (path.basename(f) === 'opengraph-image') {
    fs.renameSync(f, `${f}.png`);
    renamed++;
  }
}
let patched = 0;
for (const f of files.filter((f) => /\.(html|txt)$/.test(f))) {
  const s = fs.readFileSync(f, 'utf8');
  const t = s.replace(/\/opengraph-image(?=[?"\\])/g, '/opengraph-image.png');
  if (t !== s) {
    fs.writeFileSync(f, t);
    patched++;
  }
}
console.log(`postexport: 공유 카드 ${renamed}개에 .png, 참조 ${patched}개 파일 수정`);

// 주소를 바꾼 스토리(`tf rename`)의 옛 주소 → 새 주소로 넘기는 페이지. Pages 는 서버 리다이렉트가 없다
const redirectsFile = path.resolve(import.meta.dirname, '..', 'content', 'redirects.json');
const redirects = fs.existsSync(redirectsFile) ? JSON.parse(fs.readFileSync(redirectsFile, 'utf8')) : {};
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
let moved = 0;
for (const [from, to] of Object.entries(redirects)) {
  const dir = path.join(out, 'stories', from);
  // 옛 주소에 진짜 스토리가 있거나, 새 주소가 이 빌드에 없으면(초안 등) 만들지 않는다
  if (fs.existsSync(dir) || !fs.existsSync(path.join(out, 'stories', to, 'index.html'))) continue;
  const url = `${base}/stories/${to}/`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>주소가 바뀌었습니다</title>` +
      `<link rel="canonical" href="${url}"><meta http-equiv="refresh" content="0; url=${url}">` +
      `<script>location.replace(${JSON.stringify(url)} + location.hash)</script></head>` +
      `<body><p>주소가 바뀌었습니다: <a href="${url}">${url}</a></p></body></html>\n`,
  );
  moved++;
}
if (moved) console.log(`postexport: 옛 주소 넘김 페이지 ${moved}개`);
