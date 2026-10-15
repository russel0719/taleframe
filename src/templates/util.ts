import type { ClientMedia } from '@/lib/resolve';

/** 가장 큰 파생 이미지 URL (파노라마·라이트박스용) */
export const largestOf = (m: ClientMedia) => m.full.src;
