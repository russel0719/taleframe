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
