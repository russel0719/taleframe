import type { NextConfig } from 'next';

/**
 * GitHub Pages 정적 배포.
 * 프로젝트 사이트는 https://<user>.github.io/<repo>/ 아래에 열리므로 경로 접두사가 필요하다 —
 * Actions 의 configure-pages 가 NEXT_PUBLIC_BASE_PATH 로 넘겨준다. 로컬 개발은 비어 있다.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  // Pages 는 /stories/x/ → /stories/x/index.html 로 찾는다
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
