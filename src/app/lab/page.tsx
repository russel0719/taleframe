import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { buildLab } from '@/lib/lab';
import { loadAll } from '@/lib/story/load';
import { StoryRenderer } from '@/templates/StoryRenderer';

export const metadata: Metadata = { title: '템플릿 실험실', robots: { index: false } };

/** 개발 전용: 실제 미디어로 모든 템플릿을 한 번씩. `npm run shot -- lab` 으로 점검한다 */
export default function LabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const source = loadAll()[0];
  if (!source) return <p className="section-pad">미디어가 있는 스토리가 하나 이상 있어야 한다.</p>;
  const lab = buildLab(source);
  return (
    <>
      {lab.skipped.length > 0 && (
        <p className="t-caption bg-[#fff4d6] px-6 py-3 text-ink">
          필요한 미디어가 없어 건너뛴 템플릿: {lab.skipped.join(', ')}
        </p>
      )}
      <StoryRenderer story={lab.story} manifest={source.manifest} weather={lab.weather} routes={lab.routes} />
    </>
  );
}
