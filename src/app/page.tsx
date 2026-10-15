import Link from 'next/link';
import { ViewTransition } from 'react';
import { Footer } from '@/components/Footer';
import { Img } from '@/components/Img';
import { StoryNav } from '@/components/StoryNav';
import { resolveAll } from '@/lib/resolve';
import { formatRange } from '@/lib/site';
import { loadAll } from '@/lib/story/load';

export default function Home() {
  const stories = loadAll();
  return (
    <>
      <StoryNav />
      <main>
        <section className="tone-parchment section-pad text-center">
          <h1 className="t-hero">TaleFrame</h1>
          <p className="t-lead-airy text-muted mt-4">사진과 영상으로 엮은 여행 이야기</p>
        </section>

        {stories.length === 0 && (
          <section className="tone-light section-pad text-center">
            <p className="t-body text-muted">
              아직 이야기가 없다. Claude Code 에서 <code>travel-story</code> 스킬로 첫 여행을 추가한다.
            </p>
          </section>
        )}

        {stories.map(({ story, manifest }, i) => {
          const cover = resolveAll(story, manifest)[story.cover];
          const dark = i % 2 === 1;
          return (
            <section key={story.slug} className={`${dark ? 'tone-dark' : 'tone-light'} section-pad text-center`}>
              <p className="t-tagline text-muted">{story.trip.places.join(' · ')}</p>
              <ViewTransition name={`title-${story.slug}`}>
                <h2 className="t-display-lg mt-2">{story.title}</h2>
              </ViewTransition>
              <p className="t-lead-airy mx-auto mt-3 max-w-[720px]">{story.summary}</p>
              <p className="t-caption text-muted mt-3">
                {formatRange(story.trip.start, story.trip.end)}
                {story.status === 'draft' && <span className="ml-2 rounded-pill bg-primary/15 px-2 py-0.5 text-primary">초안</span>}
              </p>
              <div className="mt-6">
                <Link href={`/stories/${story.slug}`} className="btn-pill">
                  이야기 보기
                </Link>
              </div>
              <Link href={`/stories/${story.slug}`} className="mx-auto mt-12 block max-w-[1068px]" tabIndex={-1} aria-hidden>
                <Img media={cover} sizes="(max-width: 1100px) 94vw, 1068px" className="aspect-[16/9] w-full rounded-lg" priority={i === 0} />
              </Link>
            </section>
          );
        })}
      </main>
      <Footer />
    </>
  );
}
