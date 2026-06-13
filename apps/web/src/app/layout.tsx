// Trailog Web root layout — Next 16 App Router.
//
// 책임:
// - Pretendard 폰트 + Tailwind base 로드 (globals.css)
// - metadata default (공유 페이지마다 override)
// - <html lang="ko">

import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Trailog',
  description: '여행 사진 지도 아카이브',
  // 공유 페이지는 default no-index (SEO 노출 X)
  robots: 'noindex, nofollow',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-background dark:bg-background-dark text-text-primary dark:text-text-primary-dark">
        {children}
      </body>
    </html>
  );
}
