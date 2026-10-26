import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LabView } from './LabView';

export const metadata: Metadata = { title: '템플릿 실험실', robots: { index: false } };

/** 개발 전용: 실제 미디어로 모든 템플릿을 한 번씩. `npm run shot -- lab` 으로 점검한다. `?t=a,b` 로 골라 본다 */
export default function LabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <LabView />;
}
