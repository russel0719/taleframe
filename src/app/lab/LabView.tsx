import Link from 'next/link';
import { LabFilter } from '@/components/LabFilter';
import { buildLab } from '@/lib/lab';
import { loadAll } from '@/lib/story/load';
import { StoryRenderer } from '@/templates/StoryRenderer';

/** 실험실 본문 — /lab (첫 스토리) 과 /lab/<slug> 가 같이 쓴다 */
export function LabView({ slug }: { slug?: string }) {
  const all = loadAll();
  const source = slug ? all.find((s) => s.story.slug === slug) : all[0];
  if (!source) return <p className="section-pad">미디어가 있는 스토리가 하나 이상 있어야 한다.</p>;
  const lab = buildLab(source);
  return (
    <>
      <nav className="t-caption flex flex-wrap gap-x-4 gap-y-1 bg-parchment px-6 py-3 text-ink">
        <span className="text-muted">사진 출처:</span>
        {all.map(({ story }) => (
          <Link key={story.slug} href={`/lab/${story.slug}`} className={story.slug === source.story.slug ? 'font-semibold' : 'text-primary'}>
            {story.title}
          </Link>
        ))}
      </nav>
      <LabFilter />
      {lab.skipped.length > 0 && (
        <p className="t-caption bg-[#fff4d6] px-6 py-3 text-ink">
          필요한 미디어가 없어 건너뛴 템플릿: {lab.skipped.join(', ')}
        </p>
      )}
      <StoryRenderer story={lab.story} manifest={source.manifest} weather={lab.weather} routes={lab.routes} />
    </>
  );
}
