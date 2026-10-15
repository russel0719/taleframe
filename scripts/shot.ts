/**
 * 미리보기 점검용 스크린샷. 스크롤 장면(sticky·scrub·지도)은 전체 페이지 캡처로는 안 보이므로
 * 화면 높이씩 내려가며 찍고, 8컷씩 한 장으로 묶는다 (Claude 가 몇 번의 Read 로 훑어볼 수 있게).
 *
 *   npm run shot -- <slug> [--url http://localhost:3000] [--only desktop|mobile]
 *
 * 결과: work/<slug>/shots/{desktop,mobile}-NN.jpg, 콘솔 오류는 화면에 출력
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContextOptions } from 'playwright';
import sharp from 'sharp';
import { fail, workDir } from './lib/common';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--')) ?? fail('slug 가 필요하다');
const opt = (k: string) => (args.includes(k) ? args[args.indexOf(k) + 1] : undefined);
const base = opt('--url') ?? 'http://localhost:3000';
const only = opt('--only');
const url = slug === 'home' ? base : `${base}/stories/${slug}`;
const out = path.join(workDir(slug), 'shots');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const devices: { name: string; ctx: BrowserContextOptions; thumb: number }[] = [
  { name: 'desktop', ctx: { viewport: { width: 1440, height: 900 } }, thumb: 480 },
  { name: 'mobile', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, thumb: 240 },
];

const browser = await chromium.launch();
const problems: string[] = [];
try {
  for (const d of devices.filter((d) => !only || d.name === only)) {
    const ctx = await browser.newContext({ ...d.ctx, locale: 'ko-KR' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`[${d.name}] ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`[${d.name}] console: ${m.text().slice(0, 300)}`);
    });
    page.on('response', (r) => {
      if (r.status() >= 400) problems.push(`[${d.name}] ${r.status()} ${r.url()}`);
    });
    const res = await page.goto(url, { waitUntil: 'networkidle' });
    if (!res?.ok()) fail(`${url} → ${res?.status()} (npm run dev 가 떠 있는지 확인)`);

    const vh = d.ctx.viewport!.height;
    const frames: Buffer[] = [];
    for (let y = 0, i = 0; i < 64; i++) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(1000);
      // 보이는 이미지가 다 받아질 때까지 (최대 4초)
      await page
        .waitForFunction(
          () =>
            [...document.images].every((img) => {
              const r = img.getBoundingClientRect();
              return r.bottom < 0 || r.top > innerHeight || img.complete;
            }),
          undefined,
          { timeout: 4000 },
        )
        .catch(() => {});
      frames.push(await page.screenshot({ type: 'jpeg', quality: 70 }));
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      if (y + vh >= total) break;
      y += Math.round(vh * 0.85);
    }

    const COLS = 4;
    const PER = 8;
    for (let s = 0; s * PER < frames.length; s++) {
      const group = frames.slice(s * PER, (s + 1) * PER);
      const tiles = await Promise.all(group.map((f) => sharp(f).resize({ width: d.thumb }).toBuffer({ resolveWithObject: true })));
      const h = Math.max(...tiles.map((t) => t.info.height));
      const gap = 8;
      const sheet = sharp({
        create: { width: COLS * (d.thumb + gap), height: Math.ceil(group.length / COLS) * (h + gap), channels: 3, background: '#888' },
      }).composite(tiles.map((t, i) => ({ input: t.data, left: (i % COLS) * (d.thumb + gap), top: Math.floor(i / COLS) * (h + gap) })));
      await sheet.jpeg({ quality: 80 }).toFile(path.join(out, `${d.name}-${String(s + 1).padStart(2, '0')}.jpg`));
    }
    frames.forEach((f, i) => fs.writeFileSync(path.join(out, `${d.name}-frame-${String(i + 1).padStart(2, '0')}.jpg`), f));
    console.log(`✓ ${d.name}: ${frames.length}컷 → ${path.relative(process.cwd(), out)}/${d.name}-NN.jpg (8컷씩)`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (problems.length) {
  console.log(`\n· 문제 ${problems.length}개:`);
  for (const p of [...new Set(problems)].slice(0, 40)) console.log(`  ${p}`);
}
