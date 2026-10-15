import Link from 'next/link';
import { StoryNav } from '@/components/StoryNav';

export default function NotFound() {
  return (
    <>
      <StoryNav />
      <main className="tone-parchment section-pad grid min-h-[70svh] place-items-center text-center">
        <div>
          <h1 className="t-display-lg">이야기를 찾을 수 없다</h1>
          <p className="t-body text-muted mt-3">주소가 바뀌었거나 아직 공개되지 않은 이야기다.</p>
          <Link href="/" className="btn-pill mt-8">
            목록으로
          </Link>
        </div>
      </main>
    </>
  );
}
