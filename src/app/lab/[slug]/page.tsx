import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { staticSlugs } from '@/lib/story/load';
import { LabView } from '../LabView';

export const metadata: Metadata = { title: '템플릿 실험실', robots: { index: false } };

export function generateStaticParams() {
  return staticSlugs();
}

/** 개발 전용: 고른 스토리의 사진으로 실험실을 그린다 */
export default async function LabStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { slug } = await params;
  return <LabView slug={slug} />;
}
