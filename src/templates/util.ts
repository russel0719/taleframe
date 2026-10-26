import type { CSSProperties } from 'react';
import type { ClientMedia } from '@/lib/resolve';

/** 가장 큰 파생 이미지 URL (파노라마·라이트박스용) */
export const largestOf = (m: ClientMedia) => m.full.src;

/**
 * PC 에서 화면을 꽉 채워도 되는 가로 사진인지 (1.5:1 이상).
 * 사용자는 주로 1:1 로 찍는다 (다카마쓰 217장 중 213장) — 꽉 채우면 위아래가 크게 잘려서,
 * 그 밖의 사진은 PC 에서 원래 비율 그대로 여백을 두고 놓는다 (사용자 요청 2026-10-26). 모바일은 그대로.
 */
export const isWide = (m: { width: number; height: number }) => m.width / m.height >= 1.5;

/** CSS 변수 --ar(가로/세로) — FRAME 같은 클래스가 쓴다. 소수 넷째 자리까지 (하이드레이션) */
export const arVar = (m: { width: number; height: number }) => ({ '--ar': (m.width / m.height).toFixed(4) }) as CSSProperties;

/**
 * PC(md 이상)에서 원래 비율 그대로 화면 안에 들어가는 상자 — 높이는 화면의 82%, 가로는 화면 폭 86% 를 넘지 않는다.
 * 부모에 arVar(m) 가 있어야 한다. 모바일에서는 아무 효과 없음 (각 템플릿의 원래 모바일 배치를 쓴다)
 */
export const FRAME = 'md:aspect-[var(--ar)] md:h-[min(82svh,calc(86vw/var(--ar)))] md:w-auto';

/**
 * 폭을 채우는 사진을 원래 비율로 — 높이가 화면의 vh% 를 넘지 않게 폭을 줄이고 가운데 둔다 (자르지 않는다).
 * 가로 사진은 폭 상한에 먼저 걸려 그대로 넓게 나온다
 */
export const fitStyle = (m: { width: number; height: number }, vh = 80): CSSProperties => ({
  aspectRatio: `${m.width} / ${m.height}`,
  maxWidth: `calc(${vh}svh * ${(m.width / m.height).toFixed(4)})`,
  marginInline: 'auto',
});
