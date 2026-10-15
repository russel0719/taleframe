import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { loadAll, loadStory } from '@/lib/story/load';
import { StoryRenderer } from '@/templates/StoryRenderer';

export const dynamicParams = false;

export function generateStaticParams() {
  return loadAll().map(({ story }) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const loaded = loadStory(slug);
  if (!loaded) return {};
  const { story } = loaded;
  return {
    title: story.title,
    description: story.summary,
    openGraph: { title: story.title, description: story.summary, type: 'article', locale: 'ko_KR' },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const loaded = loadStory(slug);
  if (!loaded) notFound();
  return (
    <>
      <StoryRenderer story={loaded.story} manifest={loaded.manifest} weather={loaded.weather} routes={loaded.routes} />
      <Footer />
    </>
  );
}
