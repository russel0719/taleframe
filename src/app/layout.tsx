import type { Metadata, Viewport } from 'next';
import { siteUrl } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: 'TaleFrame', template: '%s · TaleFrame' },
  description: '사진과 영상으로 엮은 여행 이야기',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard — SF Pro 가 없는 기기(Windows·Android)에서 한글을 SF 계열 인상으로. 쓰는 글자만 받는 동적 서브셋 */}
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
