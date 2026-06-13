// Trailog Web (apps/web) — Next 16 설정.
//
// 학습 박제:
// - Next 16부터 Turbopack이 dev/build default (이전 webpack은 opt-in).
// - reactStrictMode default true.
// - typedRoutes — App Router의 typed routes (experimental → stable).

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 이미지 도메인 — R2 presigned URL 허용
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
    ],
  },

  // typed routes — App Router 타입 안전 link
  typedRoutes: true,
};

export default nextConfig;
