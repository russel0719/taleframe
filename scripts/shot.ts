/**
 * 미리보기 점검용 스크린샷. 스크롤 장면(sticky·scrub·지도)은 전체 페이지 캡처로는 안 보이므로
 * 화면 높이씩 내려가며 찍고, 8컷씩 한 장으로 묶는다 (Claude 가 몇 번의 Read 로 훑어볼 수 있게).
 *
 *   npm run shot -- <slug> [--url http://localhost:3000] [--only desktop|mobile]
 *   npm run shot -- lab      # 템플릿 실험실 (/lab) — 새 템플릿은 여기서 먼저 확인한다
 *
 * 결과: work/<slug>/shots/{desktop,mobile}-NN.jpg (컷마다 화면 가운데 섹션 id 라벨)
 * 자동 검사: 콘솔 오류 · 4xx/5xx 응답 · 깨진 이미지 · 가로 넘침. 하나라도 있으면 종료 코드 1
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
const url = slug === 'home' ? base : slug === 'lab' ? `${base}/lab` : `${base}/stories/${slug}`;
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
    const frames: { shot: Buffer; label: string }[] = [];
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
      const state = await page.evaluate(() => {
        const mid = document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest('section');
        const broken = [...document.images]
          .filter((img) => {
            const r = img.getBoundingClientRect();
            return r.bottom > 0 && r.top < innerHeight && img.complete && img.naturalWidth === 0 && img.currentSrc;
          })
          .map((img) => img.currentSrc);
        return {
          label: mid ? `${mid.id} · ${mid.dataset.template ?? ''}` : '',
          overflow: document.documentElement.scrollWidth - innerWidth,
          broken,
        };
      });
      if (state.overflow > 1) problems.push(`[${d.name}] 가로 넘침 ${state.overflow}px @ ${state.label || `y=${y}`}`);
      for (const b of state.broken) problems.push(`[${d.name}] 깨진 이미지 ${b} @ ${state.label}`);
      frames.push({ shot: await page.screenshot({ type: 'jpeg', quality: 70 }), label: `${String(i + 1).padStart(2, '0')} ${state.label}` });
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      if (y + vh >= total) break;
      y += Math.round(vh * 0.85);
    }

    const COLS = 4;
    const PER = 8;
    for (let s = 0; s * PER < frames.length; s++) {
      const group = frames.slice(s * PER, (s + 1) * PER);
      const tiles = await Promise.all(
        group.map(async (f) => {
          const t = await sharp(f.shot).resize({ width: d.thumb }).toBuffer({ resolveWithObject: true });
          // 컷 위에 섹션 라벨 — 어느 섹션의 문제인지 바로 알 수 있게
          const esc = f.label.replace(/[<&>]/g, '');
          const tag = Buffer.from(
            `<svg width="${d.thumb}" height="20"><rect width="100%" height="100%" fill="#000" opacity=".7"/><text x="6" y="14" font-family="sans-serif" font-size="12" fill="#ff0">${esc}</text></svg>`,
          );
          const data = await sharp(t.data).composite([{ input: tag, left: 0, top: 0 }]).toBuffer();
          return { data, info: t.info };
        }),
      );
      const h = Math.max(...tiles.map((t) => t.info.height));
      const gap = 8;
      const sheet = sharp({
        create: { width: COLS * (d.thumb + gap), height: Math.ceil(group.length / COLS) * (h + gap), channels: 3, background: '#888' },
      }).composite(tiles.map((t, i) => ({ input: t.data, left: (i % COLS) * (d.thumb + gap), top: Math.floor(i / COLS) * (h + gap) })));
      await sheet.jpeg({ quality: 80 }).toFile(path.join(out, `${d.name}-${String(s + 1).padStart(2, '0')}.jpg`));
    }
    frames.forEach((f, i) => fs.writeFileSync(path.join(out, `${d.name}-frame-${String(i + 1).padStart(2, '0')}.jpg`), f.shot));
    console.log(`✓ ${d.name}: ${frames.length}컷 → ${path.relative(process.cwd(), out)}/${d.name}-NN.jpg (8컷씩)`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (problems.length) {
  const unique = [...new Set(problems)];
  console.log(`\n✗ 문제 ${unique.length}개:`);
  for (const p of unique.slice(0, 40)) console.log(`  ${p}`);
  process.exitCode = 1;
} else {
  console.log('\n✓ 콘솔 오류·깨진 이미지·가로 넘침 없음 — 이제 시트를 직접 Read 해서 눈으로 본다');
}
