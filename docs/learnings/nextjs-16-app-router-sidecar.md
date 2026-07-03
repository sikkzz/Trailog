# Next 16 App Router 사이드 + shadcn/ui + Vercel 배포

> **작성일**: 2026-07-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #1 인프라 (Vercel 배포) + 프론트엔드 심화 (App Router 신버전)
> **관련 문서**: [ADR-0016 Next 16 사이드 공유 페이지](../decisions/0016-share-page-next16-sidecar.md), [Phase 3 Spec 5.1 D6](../specs/phase-03-sharing.md)

---

## 한 줄 요약

**Next 16 사이드 = 참조 Next 14 스택 한 단계 앞 정복 + 풍부한 외부 페이지 UX**. 모노레포에 `apps/web` 신규 추가해서 Trailog 공유 링크 페이지를 Next 16 App Router + shadcn/ui + Tailwind + react-query로 박음. 참조 코드가 Next 14라 최신 변화(App Router 안정화 / Turbopack default / Server Actions 확정)를 사이드에서 정복 학습. NestJS 인라인 HTML SSR 원안 폐기 이유는 UX 빈약 + 모바일 웹 아카이빙 도메인 fit X.

## 우리 프로젝트에서 어디에 쓰이는가

- **Phase 3 5.1 D6** — 외부 공유 페이지 (`trailog.app/s/{token}`)
- **apps/web** monorepo workspace 신규 (모노레포 3번째 앱 — mobile + server + web)
- Vercel 배포 (Fly.io는 백엔드만 유지)

향후 후보:

- Phase 4+ 관리자 페이지 / 대시보드
- 마케팅 랜딩 페이지
- 사용자 프로필 공개 페이지 (SNS 요소 확장 시)

## 배경 — 왜 Next 사이드로 확장했나

### 원안 — NestJS 인라인 HTML SSR

Phase 3 5.1 D6 최초 spec:

```typescript
// NestJS Controller
@Get('/s/:token')
@Render('share') // Handlebars template
async renderSharePage(@Param('token') token: string) {
  const share = await this.sharesService.findPublicByToken(token);
  return { share };
}
```

- 단일 파일 template + inline CSS
- 가장 빠른 구현 (1일)

**문제 발견**:

- **UX 빈약** — 사진 grid, 지도 미니맵, 만료 D-day 실시간 갱신, 다운로드 UX 어려움
- **본인 의도 gap** — "모바일 웹으로 풍부 정보 + 아카이빙 감성" 원함
- **재활용성 X** — 다른 페이지 만들 때마다 매번 template 새로 박아야

### 대안 — Next 16 사이드

**결정 근거**:

- **참조 stack 한 단계 앞 정복** — 참조는 Next 14, Trailog 사이드는 Next 16 → 변화 학습 자산
- **자산 재활용** — Tailwind 디자인 토큰 (Earthy Brown + Pretendard) 모바일과 mirror 가능
- **shadcn/ui** — 참조 패턴(Radix) 일관 + Next App Router 최적화
- **Vercel 무료** — Fly.io는 백엔드만, Web은 Vercel 자연스러움
- **모노레포 = 3앱 정복** — pnpm workspaces + Turbo 진가 (ADR-0001)

**포기**:

- 작업 시간 3~4일 → 6~7일 (4일 추가)
- 배포 인프라 추가 (Vercel 계정 + 도메인 연결)
- 백엔드 CORS 처리 필요 (`apps/web` origin 허용)

## Next 14 → Next 16 주요 변화

### 1. App Router 안정화 (Next 13 stable → Next 14 refinement → Next 16 default)

Pages Router는 legacy 유지지만 신규는 App Router. 파일 시스템 기반 라우팅 + Server Component default.

```
apps/web/src/app/
├── layout.tsx        # Root layout (전역 metadata + font + provider)
├── page.tsx          # / (홈)
├── s/
│   └── [token]/
│       ├── page.tsx  # /s/{token} — 공유 페이지 (Server Component)
│       ├── OpenView.tsx      # Client Component (인터랙션)
│       ├── DownloadButton.tsx
│       ├── ExpiryLabel.tsx
│       └── AddressLabel.tsx
└── api/
    └── [...]/route.ts # (Trailog는 백엔드 NestJS 활용 — 이건 미활용)
```

### 2. Server / Client Component 분리 — 명시적

```typescript
// Server Component (default) — /s/[token]/page.tsx
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; // Next 16: params는 async
  const share = await fetchShare(token); // 서버에서 fetch
  return share.status === 'locked' ? <LockedView /> : <OpenView share={share} />;
}

// Client Component — 파일 최상단에 'use client'
'use client';
export function DownloadButton({ downloadUrl }: Props) {
  return <a href={downloadUrl} download>단말 저장</a>;
}
```

**핵심 룰**:

- Server Component = default (JS 번들에 안 감. `async/await` 가능. DB/파일 접근 가능)
- Client Component = `'use client'` 명시 (`useState`/`useEffect`/브라우저 API 활용 시)
- **Server Component가 Client Component import는 OK** (반대는 X)

**Next 14 대비 Next 16 차이**:

- `params` / `searchParams` 가 **Promise** 로 변경 (async 처리 강제)
- 이유: 부분 렌더링(PPR) 최적화 — 정적 shell 먼저 스트림

### 3. Turbopack default (Next 16)

```json
// package.json (Next 16)
{
  "scripts": {
    "dev": "next dev --turbopack", // default에 turbopack
    "build": "next build"
  }
}
```

- Rust 기반 번들러 (Vercel 사내 개발)
- Webpack 대비 dev 10x+ 빠름 (측정 기준 편차)
- Phase 3 진행 중 실감 — dev server 시작 5초 → 1초

### 4. next-lint 제거 (Next 16)

Next 15까지는 `next lint` CLI 제공 (내부 ESLint wrapper). Next 16부터 **제거** — ESLint를 직접 활용해야 함.

**Trailog 대응** (Phase 3 5.1 CI fix):

```javascript
// apps/web/eslint.config.mjs — flat config (v9)
import js from '@eslint/js';
import next from '@next/eslint-plugin-next';
import ts from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  {
    plugins: { '@next/next': next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
    },
  },
];
```

CI script도 정정:

```yaml
# Before (Next 15)
- run: pnpm --filter @trailog/web lint # next lint 실행

# After (Next 16)
- run: pnpm --filter @trailog/web lint # eslint src/ 직접
```

### 5. Server Actions 안정화

Next 14에서 실험적 → Next 16 안정. Client에서 서버 함수를 form submit처럼 호출.

**Trailog는 미활용**:

- 이미 NestJS 백엔드 REST API 존재
- Server Actions는 backend가 없는 Next fullstack 시나리오에 자연
- Trailog는 클라이언트가 백엔드 REST 호출 (react-query)

## shadcn/ui — 컴포넌트 시스템

### 왜 shadcn인가

```bash
# 컴포넌트 install (npm publish된 package X, 코드 복사 방식)
npx shadcn@latest add button
# → apps/web/src/components/ui/button.tsx 파일 생성
```

**철학**:

- 라이브러리 X, **코드 소유** — `apps/web/src/components/ui/`에 복사 → 자유롭게 수정
- 기반: Radix UI (headless a11y) + Tailwind (스타일)
- Next App Router 최적화 (Server Component 호환)

**Trailog 채택 사유**:

- 참조 코드 shadcn 활용 → 실무 스택 정복
- Tailwind 디자인 토큰 그대로 활용 (모바일 NativeWind와 mirror)
- a11y 자동 (Radix가 다 처리)

### Radix UI 짧게

**Headless a11y 컴포넌트 라이브러리**:

- 동작 (키보드 네비, 포커스 트랩, ARIA)만 제공
- 스타일 X → Tailwind로 자유롭게
- Dialog, DropdownMenu, Popover, Tooltip 등 표준 인터랙션

**대안과 비교**:

- **Material UI**: 스타일 강제 → Tailwind 자유도 낮음
- **Chakra UI**: 스타일 시스템 자체 → CSS-in-JS 부담
- **Ant Design**: 엔터프라이즈 스타일 → Trailog UX와 안 맞음
- **Radix + Tailwind (shadcn)**: 자유도 최고, 학습 곡선 있음 (설정 초기 부담)

## 디자인 토큰 mirror — 모바일과 통일

**모바일 (NativeWind v4)**:

```javascript
// apps/mobile/tailwind.config.js
theme: {
  extend: {
    colors: {
      primary: '#5C4033',      // earthy brown
      background: '#FFFCF9',
      surface: '#FFFFFF',
      // ...
    }
  }
}
```

**웹 (Tailwind + CSS 변수)**:

```css
/* apps/web/src/app/globals.css */
@theme {
  --color-primary: #5c4033;
  --color-background: #fffcf9;
  --color-surface: #ffffff;
  /* dark: */
  --color-primary-dark: #c9a085;
}
```

**핵심**: 모바일 NativeWind와 **정확히 같은 색상 hex** 활용 → 사용자가 모바일/웹 넘나들 때 이질감 X.

**폰트도 통일**:

- Pretendard 4 weight (모바일 expo-font, 웹은 `<link rel="preload">`)
- `font-pretendard`, `font-pretendard-medium` 등 className 일관

## Vercel 배포 흐름

### 1. 프로젝트 등록

Vercel Dashboard → New Project → GitHub `sikkzz/Trailog` import → Root Directory `apps/web` 지정.

### 2. Build 설정

```
Framework Preset: Next.js
Build Command: cd ../.. && pnpm --filter @trailog/web build
Install Command: cd ../.. && pnpm install
Output Directory: (Next default)
```

**핵심**:

- 모노레포라 root에서 pnpm install → 전체 workspace 의존성 설치
- build 명령은 filter로 `@trailog/web`만 (Turbo 캐시 활용)

### 3. 환경변수

```
NEXT_PUBLIC_API_URL=https://trailog-server.fly.dev
NCP_CLIENT_ID=xxx (백엔드 proxy로만 활용, 서버 사이드)
```

**주의**:

- `NEXT_PUBLIC_*` prefix = 클라이언트 노출 OK (build time inline)
- 시크릿(예: NCP secret)은 절대 `NEXT_PUBLIC_*` 아니게

### 4. 자동 배포

- `main` push → Production 자동 배포
- PR → Preview 배포 (URL 생성 → 확인 링크)
- Vercel이 자동 SSL + CDN + edge caching

### 5. 커스텀 도메인

- Vercel → Domains → `trailog.app` 추가
- DNS 설정: A record 또는 CNAME (Vercel 안내대로)

## 핵심 개념

### 1. Server vs Client Component 판단 룰

**Server (default)**:

- 데이터 fetch (DB, API)
- 큰 라이브러리 (JS 번들 절약)
- SEO 메타데이터
- 초기 렌더 정적 콘텐츠

**Client (`'use client'`)**:

- `useState`, `useEffect`, `useRef`
- 이벤트 핸들러 (`onClick`, `onSubmit`)
- 브라우저 API (`window`, `document`, `localStorage`)
- 3rd-party 훅 (react-query, react-hook-form 등)

**Trailog 실제 분할**:

```
/s/[token]/page.tsx           — Server (백엔드 fetch)
  ├── LockedView              — Server (정적)
  └── OpenView                — Client ('use client')
        ├── AddressLabel      — Client (react-query)
        ├── ExpiryLabel       — Client (Date.now 폴링)
        └── DownloadButton    — Client (a href download)
```

### 2. Metadata API

```typescript
// app/layout.tsx
export const metadata: Metadata = {
  title: 'Trailog — 여행 사진 지도 아카이브',
  description: '외부 공유 페이지',
  openGraph: {
    title: 'Trailog',
    images: ['/og-image.png'],
  },
};

// app/s/[token]/page.tsx — 동적 메타데이터
export async function generateMetadata({ params }): Promise<Metadata> {
  const { token } = await params;
  const share = await fetchShare(token);
  return {
    title: share.moment?.title ?? '공유된 사진',
    description: `${share.moment?.photos.length ?? 1}장의 사진`,
  };
}
```

**핵심**:

- Server Component 안에서만 export
- Client Component엔 X (JS 번들 커짐 회피)

### 3. Loading UI (Suspense boundary)

```
apps/web/src/app/s/[token]/
├── page.tsx        # 실제 페이지
├── loading.tsx     # 자동으로 Suspense 감쌈
└── error.tsx       # 자동으로 ErrorBoundary
```

파일명 규약만으로 Suspense/ErrorBoundary 자동 wrap. Trailog는 loading.tsx 최소 활용 (share fetch가 빠름).

### 4. next.config.mjs

```javascript
export default {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.r2.cloudflarestorage.com' }],
  },
  // Turbopack default (Next 16)
  // reactCompiler 실험적 — 후속 검토
};
```

- **remotePatterns** 필수 — `<Image src>` 외부 URL은 whitelist 박아야 함. R2 CDN이 여기 등록됨.
- **Turbopack** — `next dev` 기본. `next build`는 아직 Webpack (16.x 진행 중)

### 5. react-query + Server Component 통합

```typescript
// app/s/[token]/OpenView.tsx (Client)
'use client';
import { useQuery } from '@tanstack/react-query';

export function OpenView({ share }: Props) {
  const { data: address } = useQuery({
    queryKey: ['reverse-geocode', share.photo.location],
    queryFn: () => fetchAddress(share.photo.location),
    enabled: !!share.photo.location,
  });
  // ...
}
```

**패턴**:

- Server Component가 초기 share 데이터 fetch
- Client Component가 부수 데이터 (주소, 만료 D-day 등) react-query로 fetch
- **QueryClientProvider**는 Client Component wrapper (`app/providers.tsx`)로 격리

## Trailog 실제 폴더 구조

```
apps/web/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # 폰트 + metadata
│   │   ├── page.tsx             # 홈 (미구현 — 미리보기 안내)
│   │   ├── providers.tsx        # 'use client' — QueryClient
│   │   ├── globals.css          # Tailwind + theme
│   │   └── s/
│   │       └── [token]/
│   │           ├── page.tsx     # Server — share fetch + status 분기
│   │           ├── LockedView.tsx  # Server
│   │           ├── OpenView.tsx    # Client — 인터랙션
│   │           ├── AddressLabel.tsx
│   │           ├── ExpiryLabel.tsx
│   │           └── DownloadButton.tsx
│   ├── lib/
│   │   ├── api.ts               # fetch wrapper
│   │   ├── format.ts            # formatDateTime 등
│   │   └── schemas.ts           # Zod (모바일 mirror)
│   └── components/
│       └── ui/                  # shadcn 컴포넌트 (button, ...)
├── eslint.config.mjs            # flat config (Next 16 next-lint 대응)
├── next.config.mjs
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## 함정 (10종)

### 1. Params async — Next 16 새 규칙

```typescript
// ❌ Next 15 스타일
export default function Page({ params }: { params: { token: string } }) {
  const { token } = params;
}

// ✅ Next 16
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
}
```

Next 15 → 16 마이그레이션 시 가장 흔한 실수. **모든 params/searchParams await**.

### 2. `'use client'` 파일 상단 — 첫 줄 필수

주석 위에 두면 안 됨:

```typescript
// ❌
// 컴포넌트 설명
'use client';

// ✅
'use client';

// 컴포넌트 설명
```

### 3. Client Component에서 async default export

```typescript
// ❌ Client Component는 async 함수 X
'use client';
export default async function Page() { ... }

// ✅ Server Component만 async
export default async function Page() { ... } // (use client 없음)
```

### 4. `next/image` remotePatterns 빠뜨림

외부 이미지 hostname 미등록 시:

```
Error: Invalid src prop (https://r2.cloudflarestorage.com/...) on `next/image`, hostname "r2.cloudflarestorage.com" is not configured under images in your `next.config.mjs`
```

**해결**: `next.config.mjs` `images.remotePatterns` 추가. wildcard(`*.r2.cloudflarestorage.com`) 활용.

### 5. Vercel 모노레포 Install 명령 오해

Vercel default install: 프로젝트 root(`apps/web`)에서 `npm install`. **모노레포엔 실패**. **모노레포 root에서 pnpm install 해야 함**:

```
Install Command: cd ../.. && pnpm install
Build Command: cd ../.. && pnpm --filter @trailog/web build
```

### 6. Vercel 환경변수 `NEXT_PUBLIC_*` prefix 오해

```
❌ API_URL=https://... — Client Component에서 접근 X (undefined)
✅ NEXT_PUBLIC_API_URL=https://... — Build time inline
```

Server Component에선 prefix 없어도 OK (Node 환경). Client에선 prefix 필수.

### 7. CORS 백엔드 설정 빠뜨림

Vercel 배포 후 API 호출 실패 (CORS blocked):

```
Access to fetch at 'https://api.trailog.app/...' from origin 'https://trailog.app' has been blocked by CORS policy
```

**해결**: NestJS `main.ts` CORS 설정에 웹 origin 추가:

```typescript
app.enableCors({
  origin: ['http://localhost:3000', 'https://trailog.app'],
  credentials: true,
});
```

### 8. shadcn install 시 tailwind config 오해

shadcn CLI가 처음 `init` 시 `tailwind.config.ts` 자동 수정. **이미 있는 설정 덮어씀**. 신중히 (또는 backup).

### 9. `next lint` 명령 습관

Next 16부터 제거됐는데 CI/husky에 계속 박아두면 fail:

```
Error: `next lint` has been removed. Use ESLint directly.
```

**Trailog 실제 hit** — Phase 3 5.1 fix commit(`fbe0562`).

### 10. Server Component에서 브라우저 API 접근

```typescript
export default function Page() {
  const width = window.innerWidth; // ❌ Server에선 window X
}
```

**증상**: 빌드는 통과, 실행 시 crash. `'use client'` 추가하거나 useEffect 안으로 이동.

## Phase 후속 정복 항목

- **Partial Prerendering (PPR)** — Next 16 실험 기능 안정화 시 도입
- **React Compiler** — 자동 메모이제이션 (Next 16 실험)
- **Server Actions** — 관리자 페이지 만들 때 백엔드 API 없이 서버 함수 활용 검토
- **Middleware** — 인증 필요한 페이지 만들 때 (`/settings/*` 등)
- **ISR (Incremental Static Regeneration)** — 마케팅 페이지 캐싱

## 참고 링크

- [Next.js 16 Docs](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Vercel Docs](https://vercel.com/docs)
- [ADR-0016 Next 16 사이드 결정](../decisions/0016-share-page-next16-sidecar.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
