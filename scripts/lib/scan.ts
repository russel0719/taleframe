import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import exifr from 'exifr';
import heicConvert from 'heic-convert';
import sharp from 'sharp';
import { FFMPEG, fail, pool, readJson, run, workDir, writeJson } from './common';
import { probeVideo } from './probe';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.tif', '.tiff']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

export type InventoryItem = {
  id: string;
  /** 원본 폴더 기준 상대 경로 */
  file: string;
  kind: 'image' | 'video';
  width: number;
  height: number;
  takenAt: string | null;
  gps: { lat: number; lng: number } | null;
  duration?: number;
  hasAudio?: boolean;
  bytes: number;
  /** work/<slug>/ 기준 썸네일 경로. 영상은 10% · 50% · 85% 세 장 */
  thumbs: string[];
  /**
   * HEIC 처럼 sharp 가 못 읽는 원본의 픽셀용 JPEG 사본 (work/<slug>/ 기준).
   * 날짜·GPS 는 원본에서 읽고, 사진 처리(썸네일·파생 파일)만 이 사본으로 한다
   */
  pixels?: string;
};

const HEIC_EXT = new Set(['.heic', '.heif']);

/** HEIC → 픽셀용 JPEG 사본. 이미 있으면 다시 만들지 않는다 */
async function heicPixels(slug: string, abs: string, rel: string): Promise<string> {
  const name = `heic/${crypto.createHash('sha1').update(rel).digest('hex').slice(0, 12)}.jpg`;
  const out = path.join(workDir(slug), name);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const jpg = await heicConvert({ buffer: fs.readFileSync(abs), format: 'JPEG', quality: 0.95 });
    fs.writeFileSync(out, Buffer.from(jpg));
  }
  return name;
}

/** 사진 처리에 쓸 실제 파일 — HEIC 면 JPEG 사본, 아니면 원본 */
export function pixelPath(slug: string, sourceDir: string, it: Pick<InventoryItem, 'file' | 'pixels'>) {
  return it.pixels ? path.join(workDir(slug), it.pixels) : path.join(sourceDir, it.file);
}

export type Inventory = {
  slug: string;
  sourceDir: string;
  scannedAt: string;
  items: InventoryItem[];
  /** 읽지 못한 파일 */
  skipped: { file: string; reason: string }[];
};

export const inventoryPath = (slug: string) => path.join(workDir(slug), 'inventory.json');

export function loadInventory(slug: string): Inventory {
  const p = inventoryPath(slug);
  if (!fs.existsSync(p)) fail(`${p} 가 없다 — 먼저 \`tf scan <폴더> --slug ${slug}\``);
  return readJson<Inventory>(p);
}

function walk(dir: string, rel = ''): string[] {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((d) => {
    if (d.name.startsWith('.')) return [];
    const r = path.join(rel, d.name);
    return d.isDirectory() ? walk(dir, r) : [r];
  });
}

/** EXIF "2026:02:07 09:23:59" + "+09:00" → ISO */
function exifDate(raw?: string, offset?: string): string | null {
  const m = raw?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset ?? ''}`;
}

async function scanImage(abs: string, pixelsAbs = abs) {
  const meta = await sharp(pixelsAbs).metadata();
  const swap = (meta.orientation ?? 1) >= 5;
  const exif = (await exifr
    .parse(abs, { reviveValues: false, pick: ['DateTimeOriginal', 'OffsetTimeOriginal', 'CreateDate', 'OffsetTime'] })
    .catch(() => null)) as Record<string, string> | null;
  const gps = await exifr.gps(abs).catch(() => null);
  return {
    width: swap ? meta.height! : meta.width!,
    height: swap ? meta.width! : meta.height!,
    takenAt: exifDate(exif?.DateTimeOriginal ?? exif?.CreateDate, exif?.OffsetTimeOriginal ?? exif?.OffsetTime),
    gps: gps && Number.isFinite(gps.latitude) ? { lat: gps.latitude, lng: gps.longitude } : null,
  };
}

async function thumbImage(abs: string, out: string) {
  await sharp(abs).rotate().resize(512, 512, { fit: 'inside' }).jpeg({ quality: 72 }).toFile(out);
}

async function thumbVideo(abs: string, at: number, out: string) {
  await run(FFMPEG, ['-v', 'error', '-y', '-ss', at.toFixed(2), '-i', abs, '-frames:v', '1', '-vf', 'scale=512:512:force_original_aspect_ratio=decrease', '-q:v', '4', out]);
}

/** 12장씩 id 를 붙인 밀착 인화지 — 스킬이 한 번에 훑어보기 위한 것 */
async function contactSheets(slug: string, items: InventoryItem[]) {
  const dir = workDir(slug);
  const CELL = 360;
  const COLS = 4;
  const PER = 12;
  const sheets: string[] = [];
  for (let s = 0; s * PER < items.length; s++) {
    const group = items.slice(s * PER, (s + 1) * PER);
    const rows = Math.ceil(group.length / COLS);
    const composites = await Promise.all(
      group.map(async (it, i) => {
        const thumb = it.thumbs[it.kind === 'video' ? 1 : 0];
        const img = await sharp(path.join(dir, thumb)).resize(CELL - 8, CELL - 40, { fit: 'inside' }).toBuffer();
        const time = it.takenAt?.slice(5, 16).replace('T', ' ') ?? '시각 없음';
        const label = `${it.id}${it.kind === 'video' ? ` ▶ ${Math.round(it.duration ?? 0)}s` : ''}  ${time}`;
        const svg = Buffer.from(
          `<svg width="${CELL}" height="32"><rect width="100%" height="100%" fill="#000"/><text x="8" y="22" font-family="sans-serif" font-size="18" fill="#fff">${label}</text></svg>`,
        );
        const x = (i % COLS) * CELL;
        const y = Math.floor(i / COLS) * CELL;
        return [
          { input: img, left: x + 4, top: y + 4 },
          { input: svg, left: x, top: y + CELL - 32 },
        ];
      }),
    );
    const file = `sheets/sheet-${String(s + 1).padStart(2, '0')}.jpg`;
    fs.mkdirSync(path.join(dir, 'sheets'), { recursive: true });
    await sharp({ create: { width: COLS * CELL, height: rows * CELL, channels: 3, background: '#1d1d1f' } })
      .composite(composites.flat())
      .jpeg({ quality: 78 })
      .toFile(path.join(dir, file));
    sheets.push(file);
  }
  return sheets;
}

export async function scan(sourceDir: string, slug: string) {
  const src = path.resolve(sourceDir);
  if (!fs.existsSync(src)) fail(`폴더가 없다: ${src}`);
  const dir = workDir(slug);
  fs.mkdirSync(path.join(dir, 'thumbs'), { recursive: true });

  // 다시 스캔해도 id 가 바뀌지 않게 이전 매핑을 유지한다 (analysis.json, story.json 이 id 로 참조하므로)
  const prev = fs.existsSync(inventoryPath(slug)) ? readJson<Inventory>(inventoryPath(slug)) : null;
  if (prev && prev.sourceDir !== src) {
    fail(`${slug} 는 이미 다른 폴더(${prev.sourceDir})로 스캔했다. 다른 slug 를 쓰거나 work/${slug} 를 지운다`);
  }
  const prevByFile = new Map(prev?.items.map((it) => [it.file, it]) ?? []);

  const files = walk(src).filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext);
  });
  console.log(`· ${files.length}개 파일 스캔 중…`);

  const skipped: Inventory['skipped'] = [];
  const scanned = await pool(files, 4, async (file) => {
    const abs = path.join(src, file);
    const kind = VIDEO_EXT.has(path.extname(file).toLowerCase()) ? ('video' as const) : ('image' as const);
    try {
      const bytes = fs.statSync(abs).size;
      if (kind === 'image') {
        if (HEIC_EXT.has(path.extname(file).toLowerCase())) {
          const pixels = await heicPixels(slug, abs, file);
          return { file, kind, bytes, pixels, ...(await scanImage(abs, path.join(workDir(slug), pixels))) };
        }
        return { file, kind, bytes, ...(await scanImage(abs)) };
      }
      const p = await probeVideo(abs);
      return {
        file,
        kind,
        bytes,
        width: p.width,
        height: p.height,
        takenAt: p.takenAt,
        gps: p.gps,
        duration: Math.round(p.duration * 10) / 10,
        hasAudio: p.audioIndex !== null,
      };
    } catch (e) {
      const reason = (e as Error).message.split('\n')[0];
      skipped.push({
        file,
        reason: /heif|heic/i.test(file) ? `HEIC 변환 실패 (JPEG 로 내보내서 다시 올린다): ${reason}` : reason,
      });
      return null;
    }
  });

  const ok = scanned.filter((x): x is NonNullable<typeof x> => x !== null);
  ok.sort((a, b) => (a.takenAt ?? '9999').localeCompare(b.takenAt ?? '9999') || a.file.localeCompare(b.file));

  let nextId = Math.max(0, ...(prev?.items.map((it) => Number(it.id.slice(1))) ?? [])) + 1;
  const items: InventoryItem[] = await pool(ok, 4, async (it) => {
    const id = prevByFile.get(it.file)?.id ?? `m${String(nextId++).padStart(3, '0')}`;
    const abs = path.join(src, it.file);
    let thumbs: string[];
    if (it.kind === 'image') {
      thumbs = [`thumbs/${id}.jpg`];
      if (!fs.existsSync(path.join(dir, thumbs[0]))) await thumbImage(pixelPath(slug, src, it), path.join(dir, thumbs[0]));
    } else {
      thumbs = ['a', 'b', 'c'].map((s) => `thumbs/${id}_${s}.jpg`);
      const at = [0.1, 0.5, 0.85].map((r) => r * (it.duration ?? 1));
      for (let i = 0; i < 3; i++) {
        if (!fs.existsSync(path.join(dir, thumbs[i]))) await thumbVideo(abs, at[i], path.join(dir, thumbs[i]));
      }
    }
    return { id, ...it, thumbs };
  });
  items.sort((a, b) => a.id.localeCompare(b.id));

  const inventory: Inventory = { slug, sourceDir: src, scannedAt: new Date().toISOString(), items, skipped };
  writeJson(inventoryPath(slug), inventory);
  const sheets = await contactSheets(slug, items);

  // 요약
  const days = new Map<string, number>();
  for (const it of items) {
    const d = it.takenAt?.slice(0, 10) ?? '날짜 없음';
    days.set(d, (days.get(d) ?? 0) + 1);
  }
  const videos = items.filter((i) => i.kind === 'video');
  console.log(`\n✓ ${items.length}개 (사진 ${items.length - videos.length}, 영상 ${videos.length}) → ${path.relative(process.cwd(), inventoryPath(slug))}`);
  console.log(`  GPS 있음: ${items.filter((i) => i.gps).length}개 · 시각 없음: ${items.filter((i) => !i.takenAt).length}개`);
  console.log('  날짜별:');
  for (const [d, n] of [...days].sort()) console.log(`    ${d}  ${n}개`);
  if (videos.length) {
    console.log('  영상:');
    for (const v of videos) console.log(`    ${v.id}  ${v.duration}s  ${v.width}x${v.height}${v.hasAudio ? '  소리 있음' : ''}`);
  }
  console.log(`  밀착 인화지: ${sheets.map((s) => path.join('work', slug, s)).join(', ')}`);
  if (skipped.length) {
    console.log(`\n· 건너뜀 ${skipped.length}개:`);
    for (const s of skipped) console.log(`    ${s.file}: ${s.reason}`);
  }
}
