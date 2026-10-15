'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/** 화면에 들어올 때 살짝 떠오르며 나타난다. 모션 줄이기 설정이면 그냥 보인다 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = 'div',
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'li' | 'figure';
}) {
  const reduce = useReducedMotion();
  const M = motion[as];
  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0, 0, 1] }}
    >
      {children}
    </M>
  );
}
