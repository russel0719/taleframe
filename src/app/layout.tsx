import type { Metadata, Viewport } from 'next';
import { Nanum_Pen_Script, Noto_Serif_KR } from 'next/font/google';
import { siteUrl } from '@/lib/site';
import './globals.css';

// 작품 섹션(세로쓰기 시·전시 캡션)용 명조. 한글은 unicode-range 조각으로 나뉘어 쓰는 글자만 받는다
const serif = Noto_Serif_KR({ weight: ['400', '600'], subsets: ['latin'], preload: false, display: 'swap', variable: '--font-noto-serif' });
// 엽서·메모의 손글씨 — 기록물 섹션 전용
const hand = Nanum_Pen_Script({ weight: '400', subsets: ['latin'], preload: false, display: 'swap', variable: '--font-nanum-pen' });

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
    <html lang="ko" className={`${serif.variable} ${hand.variable}`}>
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
