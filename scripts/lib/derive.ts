import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp, { type Sharp } from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import { Vibrant } from 'node-vibrant/node';
import { fileNames } from '@/lib/media';
import { MediaManifest, Story, type MediaEntry, type MediaOptions } from '@/lib/story/schema';
import { collectUsage, type MediaUsage } from '@/templates/catalog';
import { FFMPEG, fail, mediaDir, pool, readJson, run, storyDir, writeJson } from './common';
import { leakedTags, probeVideo } from './probe';
import { loadInventory, type InventoryItem } from './scan';

/** 파생 규칙이 바뀌면 올린다 — 해시가 바뀌어 전부 다시 만들어지고, CDN 캐시도 자연히 갈린다 */
const DERIVE_VERSION = 2;
const IMAGE_WIDTHS = [640, 1280, 2048];
const PANORAMA_WIDTHS = [2048, 4096, 8192];
const POSTER_WIDTHS = [640, 1280, 1920];
const VIDEO_SHORT_SIDE = 1080;
const SCRUB_SHORT_SIDE = 720;

const TONEMAP =
  'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p';

const scaleShort = (s: number) => `scale='if(gte(iw,ih),-2,min(${s},iw))':'if(gte(iw,ih),min(${s},ih),-2)'`;

function pickWidths(targets: number[], width: number) {
  const ws = targets.filter((w) => w <= width);
  if (!ws.length || (width > ws[ws.length - 1] && width < targets[targets.length - 1])) ws.push(width);
  return ws;
}

async function thumbhash(img: Sharp) {
  const { data, info } = await img
    .clone()
    .resize(100, 100, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString('base64');
}

/**
 * sharp 의 attention 크롭으로 피사체 중심을 찾는다.
 * 가로로 좁은 띠를 잘라 x 를, 세로로 낮은 띠를 잘라 y 를 얻는다.
 */
async function focusPoint(img: Sharp): Promise<[number, number]> {
  const { data, info } = await img.clone().resize(480, 480, { fit: 'inside' }).toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const strip = async (cw: number, ch: number) =>
    (await sharp(data).resize(cw, ch, { fit: 'cover', position: sharp.strategy.attention }).toBuffer({ resolveWithObject: true })).info;
  const cw = Math.max(1, Math.round(w / 3));
  const ch = Math.max(1, Math.round(h / 3));
  const xi = await strip(cw, h);
  const yi = await strip(w, ch);
  const x = (Math.abs(xi.cropOffsetLeft ?? (w - cw) / 2) + cw / 2) / w;
  const y = (Math.abs(yi.cropOffsetTop ?? (h - ch) / 2) + ch / 2) / h;
  const r = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
  return [r(x), r(y)];
}

async function palette(img: Sharp) {
  const buf = await img.clone().resize(256, 256, { fit: 'inside' }).jpeg().toBuffer();
  const p = await Vibrant.from(buf).getPalette();
  const out: Record<string, string> = {};
  for (const [name, sw] of Object.entries(p)) if (sw) out[name] = sw.hex;
  return out;
}

async function writeWebp(img: Sharp, widths: number[], name: (w: number) => string, dir: string) {
  for (const w of widths) {
    const out = path.join(dir, name(w));
    if (!fs.existsSync(out)) await img.clone().resize({ width: w }).webp({ quality: 80, effort: 4 }).toFile(out);
  }
}

async function writeOg(img: Sharp, w: number, h: number, focus: [number, number], out: string) {
  if (fs.existsSync(out)) return;
  const scale = Math.max(1200 / w, 630 / h);
  const rw = Math.round(w * scale);
  const rh = Math.round(h * scale);
  const left = Math.round(Math.min(Math.max(focus[0] * rw - 600, 0), rw - 1200));
  const top = Math.round(Math.min(Math.max(focus[1] * rh - 315, 0), rh - 630));
  const resized = await img.clone().resize(rw, rh).toBuffer();
  await sharp(resized).extract({ left, top, width: 1200, height: 630 }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
}

/** 사진: 원본 → 회전 보정 + 메타데이터 제거된 webp (sharp 는 기본적으로 EXIF/GPS 를 버린다) */
async function deriveImage(src: string, base: string, dir: string, usage: MediaUsage, isCover: boolean): Promise<MediaEntry> {
  const img = sharp(src).rotate();
  const { width, height } = await img.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
  const widths = pickWidths(usage.panorama ? PANORAMA_WIDTHS : IMAGE_WIDTHS, width);
  // 파노라마에도 일반 크기를 같이 만든다 (목록 카드·라이트박스용)
  const all = usage.panorama ? [...new Set([...pickWidths(IMAGE_WIDTHS, width), ...widths])].sort((a, b) => a - b) : widths;
  await writeWebp(img, all, (w) => fileNames.image(base, w), dir);
  const focus = await focusPoint(img);
  if (isCover) await writeOg(img, width, height, focus, path.join(dir, fileNames.og(base)));
  return {
    kind: 'image',
    base,
    width,
    height,
    widths: all,
    thumbhash: await thumbhash(img),
    focus,
    palette: await palette(img),
    ...(isCover ? { og: true } : {}),
  };
}

async function deriveVideo(src: string, base: string, dir: string, usage: MediaUsage, opt?: MediaOptions): Promise<MediaEntry> {
  const p = await probeVideo(src);
  const start = opt?.trim?.start ?? 0;
  const end = Math.min(opt?.trim?.end ?? p.duration, p.duration);
  if (end <= start) throw new Error(`trim 구간이 영상 길이(${p.duration.toFixed(1)}s)를 벗어난다`);
  const duration = end - start;
  const cut = ['-ss', start.toFixed(3), '-to', end.toFixed(3)];
  const pre = p.hdr ? `${TONEMAP},` : '';
  const strip = ['-map_metadata', '-1', '-map_metadata:s:v', '-1', '-map_metadata:s:a', '-1', '-map_chapters', '-1'];
  const outputs: string[] = [];

  // 포스터 — 영상이 로드되기 전과 모션 줄이기 설정에서 보이는 정지 화면
  const posterAt = start + Math.min(1, duration * 0.1);
  const frame = await run(FFMPEG, ['-v', 'error', '-ss', posterAt.toFixed(3), '-i', src, '-frames:v', '1', ...(pre ? ['-vf', TONEMAP] : []), '-f', 'image2pipe', '-vcodec', 'png', '-']);
  const poster = sharp(frame);
  const widths = pickWidths(POSTER_WIDTHS, p.width);
  await writeWebp(poster, widths, (w) => fileNames.poster(base, w), dir);

  const fpsCap = p.fps > 30.5 ? ['-r', '30'] : [];
  if (usage.regular) {
    const out = path.join(dir, fileNames.video(base));
    if (!fs.existsSync(out)) {
      await run(FFMPEG, [
        '-v', 'error', '-y', ...cut, '-i', src,
        '-map', '0:v:0', ...(p.audioIndex !== null ? ['-map', `0:${p.audioIndex}`] : []),
        '-vf', `${pre}${scaleShort(VIDEO_SHORT_SIDE)}`, ...fpsCap,
        // 눈·비·물결처럼 잔 디테일이 많은 화면은 CRF 만으로는 15Mbps 넘게 튄다 — 상한을 둔다
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '23', '-maxrate', '4M', '-bufsize', '8M',
        '-pix_fmt', 'yuv420p', '-profile:v', 'high',
        ...(p.audioIndex !== null ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : []),
        ...strip, '-movflags', '+faststart', out,
      ]);
    }
    outputs.push(out);
  }
  if (usage.scrub) {
    // 모든 프레임을 키프레임으로 — 스크롤로 임의 지점을 찾아갈 때 끊기지 않게
    const out = path.join(dir, fileNames.scrub(base));
    if (!fs.existsSync(out)) {
      await run(FFMPEG, [
        '-v', 'error', '-y', ...cut, '-i', src, '-map', '0:v:0', '-an',
        '-vf', `${pre}${scaleShort(SCRUB_SHORT_SIDE)}`, '-r', '24',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-maxrate', '5M', '-bufsize', '10M',
        '-g', '1', '-keyint_min', '1', '-sc_threshold', '0',
        '-pix_fmt', 'yuv420p', ...strip, '-movflags', '+faststart', out,
      ]);
    }
    outputs.push(out);
  }
  if (usage.ambient) {
    if (p.audioIndex === null) throw new Error('현장음으로 지정했지만 디코딩할 수 있는 오디오 트랙이 없다');
    const out = path.join(dir, fileNames.ambient(base));
    if (!fs.existsSync(out)) {
      const fadeOut = Math.max(0, duration - 1.5).toFixed(2);
      await run(FFMPEG, [
        '-v', 'error', '-y', ...cut, '-i', src, '-map', `0:${p.audioIndex}`, '-vn',
        '-af', `afade=t=in:d=1,afade=t=out:st=${fadeOut}:d=1.5`, '-c:a', 'aac', '-b:a', '128k', '-ac', '2',
        ...strip, '-movflags', '+faststart', out,
      ]);
    }
    outputs.push(out);
  }

  for (const out of outputs) {
    const leaked = await leakedTags(out);
    if (leaked.length) {
      fs.rmSync(out);
      throw new Error(`${path.basename(out)} 에 메타데이터가 남았다 (${leaked.join(', ')}) — 공개할 수 없어 지웠다`);
    }
  }

  return {
    kind: 'video',
    base,
    width: p.width,
    height: p.height,
    widths,
    thumbhash: await thumbhash(poster),
    focus: await focusPoint(poster),
    palette: await palette(poster),
    duration: Math.round(duration * 10) / 10,
    hasAudio: p.audioIndex !== null,
    ...(usage.regular ? { mp4: true } : {}),
    ...(usage.scrub ? { scrub: true } : {}),
    ...(usage.ambient ? { ambient: true } : {}),
  };
}

function hashFor(item: InventoryItem, sourceDir: string, opt?: MediaOptions) {
  const st = fs.statSync(path.join(sourceDir, item.file));
  const key = [DERIVE_VERSION, item.file, st.size, Math.round(st.mtimeMs), JSON.stringify(opt?.trim ?? null)].join('|');
  return crypto.createHash('sha1').update(key).digest('hex').slice(0, 8);
}

export function expectedFiles(m: MediaEntry): string[] {
  const files: string[] = [];
  if (m.kind === 'image') files.push(...m.widths.map((w) => fileNames.image(m.base, w)));
  else {
    files.push(...m.widths.map((w) => fileNames.poster(m.base, w)));
    if (m.mp4) files.push(fileNames.video(m.base));
    if (m.scrub) files.push(fileNames.scrub(m.base));
    if (m.ambient) files.push(fileNames.ambient(m.base));
  }
  if (m.og) files.push(fileNames.og(m.base));
  return files;
}

export async function deriveMedia(slug: string) {
  const storyPath = path.join(storyDir(slug), 'story.json');
  if (!fs.existsSync(storyPath)) fail(`${storyPath} 가 없다`);
  const story = Story.parse(readJson(storyPath));
  const inv = loadInventory(slug);
  const byId = new Map(inv.items.map((it) => [it.id, it]));

  const usage = collectUsage(story.sections);
  const cover = usage.get(story.cover) ?? { panorama: false, scrub: false, ambient: false, regular: false };
  cover.regular = true;
  usage.set(story.cover, cover);

  const missing = [...usage.keys()].filter((id) => !byId.has(id));
  if (missing.length) fail(`inventory 에 없는 id: ${missing.join(', ')}`);

  const dir = mediaDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  const ids = [...usage.keys()].sort();
  const images = ids.filter((id) => byId.get(id)!.kind === 'image');
  const videos = ids.filter((id) => byId.get(id)!.kind === 'video');
  console.log(`· 사진 ${images.length}개, 영상 ${videos.length}개 처리`);

  const entries: Record<string, MediaEntry> = {};
  const errors: string[] = [];
  const one = async (id: string) => {
    const it = byId.get(id)!;
    const opt = story.media?.[id];
    const base = `${id}-${hashFor(it, inv.sourceDir, opt)}`;
    const src = path.join(inv.sourceDir, it.file);
    try {
      entries[id] =
        it.kind === 'image'
          ? await deriveImage(src, base, dir, usage.get(id)!, id === story.cover)
          : await deriveVideo(src, base, dir, usage.get(id)!, opt);
      process.stdout.write(`  ✓ ${id}\n`);
    } catch (e) {
      errors.push(`${id} (${it.file}): ${(e as Error).message}`);
      process.stdout.write(`  ✗ ${id}\n`);
    }
  };
  await pool(images, 4, one);
  for (const id of videos) await one(id); // ffmpeg 는 이미 멀티스레드

  if (errors.length) fail(`파생 파일 생성 실패\n  ${errors.join('\n  ')}`);

  const manifest = MediaManifest.parse({
    version: 1,
    items: Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))),
  });
  writeJson(path.join(storyDir(slug), 'media.json'), manifest);

  // 더 이상 쓰지 않는 파생 파일 정리 (예전 해시, 빠진 컷)
  const keep = new Set(Object.values(manifest.items).flatMap(expectedFiles));
  let removed = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!keep.has(f)) {
      fs.rmSync(path.join(dir, f));
      removed++;
    }
  }
  const bytes = [...keep].reduce((n, f) => n + (fs.existsSync(path.join(dir, f)) ? fs.statSync(path.join(dir, f)).size : 0), 0);
  console.log(`\n✓ media.json 갱신 · 파일 ${keep.size}개 · ${(bytes / 1024 / 1024).toFixed(1)}MB${removed ? ` · 오래된 파일 ${removed}개 삭제` : ''}`);
}
