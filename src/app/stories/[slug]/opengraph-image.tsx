import fs from 'node:fs';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { fileNames, mediaBaseUrl } from '@/lib/media';
import { formatRange } from '@/lib/site';
import { loadAll, loadStory } from '@/lib/story/load';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '여행 이야기 대표 사진';

export function generateStaticParams() {
  return loadAll().map(({ story }) => ({ slug: story.slug }));
}

/** 카드 배경: `tf media` 가 cover 로 만든 1200x630 jpg. 로컬은 파일, 배포는 Storage 에서 */
async function background(slug: string, base: string): Promise<string | null> {
  const name = fileNames.og(base);
  const root = mediaBaseUrl();
  try {
    if (root.startsWith('/')) {
      const file = path.join(process.cwd(), 'public', 'media', slug, name);
      return `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`;
    }
    const res = await fetch(`${root}/${slug}/${name}`);
    if (!res.ok) return null;
    return `data:image/jpeg;base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
}

/** 카드에 들어가는 글자만 담은 한글 폰트 (Google Fonts text= 서브셋, Satori 가 읽는 TTF) */
async function koreanFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = loadStory(slug)!;
  const { story, manifest } = loaded;
  const cover = manifest.items[story.cover];
  const bg = cover?.og ? await background(slug, cover.base) : null;
  const sub = `${story.trip.places.join(' · ')} · ${formatRange(story.trip.start, story.trip.end)}`;
  const font = await koreanFont(story.title + sub + 'TaleFrame');

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#272729', fontFamily: 'KR' }}>
        {bg && (
          <img src={bg} width={1200} height={630} alt="" style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }} />
        )}
        <div
          style={{
            // Satori 는 inset 을 모른다 — 위치와 크기를 직접 준다
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '56px 64px',
            background: bg ? 'linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0) 65%)' : 'transparent',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: 26, opacity: 0.85 }}>{sub}</div>
          <div style={{ fontSize: 68, fontWeight: 700, letterSpacing: -1, marginTop: 8 }}>{story.title}</div>
          <div style={{ fontSize: 22, opacity: 0.7, marginTop: 20 }}>TaleFrame</div>
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: 'KR', data: font, weight: 700, style: 'normal' }] : undefined },
  );
}
