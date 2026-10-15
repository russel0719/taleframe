'use client';

import { motion, useScroll, useSpring } from 'motion/react';
import Link from 'next/link';
import { SoundToggle } from './Soundscape';

/** {component.global-nav} — 44px 검은 바. 아래쪽에 읽은 만큼 차오르는 진행 막대 */
export function StoryNav({ title, draft }: { title?: string; draft?: boolean }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });
  return (
    <header className="sticky top-0 z-50 h-[44px] bg-void text-on-dark">
      <nav className="mx-auto flex h-full max-w-[1068px] items-center justify-between gap-4 px-4">
        <Link href="/" className="t-fine font-semibold tracking-normal text-on-dark/90 hover:text-on-dark">
          TaleFrame
        </Link>
        {title && (
          <p className="t-fine min-w-0 flex-1 truncate text-center text-on-dark/70">
            {title}
            {draft && <span className="ml-2 rounded-pill bg-primary-on-dark/25 px-2 py-0.5 text-on-dark">초안</span>}
          </p>
        )}
        <div className="flex min-w-[60px] justify-end">
          <SoundToggle />
        </div>
      </nav>
      {title && <motion.div className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary-on-dark" style={{ scaleX }} />}
    </header>
  );
}
