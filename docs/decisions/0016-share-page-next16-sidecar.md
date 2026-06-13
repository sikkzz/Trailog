# ADR-0016: 공유 페이지 — Next 16 사이드 (apps/web 신규)

> **상태**: Accepted
> **날짜**: 2026-06-13
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 3 Spec 5.1 D6](../specs/phase-03-sharing.md), [ADR-0014 공유 토큰](./0014-share-link-token-uuid.md), [ADR-0011 NativeWind 디자인 시스템](./0011-mobile-design-system-nativewind.md)

---

## 맥락 (Context)

Phase 3 wave 5.1 D6 진입 시 외부 사용자(공유 받은 사람)가 접근하는 페이지 구현 방식 결정.

원안(spec 5.1 작성 시점): **NestJS 인라인 HTML SSR** — 사진 1장 + 텍스트 정도의 빈약한 UX.

본인 검토 (2026-06-13 본인 의도): "**해당 링크 자체를 모바일 웹으로 뽑아서 유저가 여러 정보들을 보고 아카이빙 할 수 있어야 한다고 생각**". 단순 HTML보다 **풍부 UX 모바일 웹**이 fit.

옵션:

1. NestJS 인라인 HTML SSR (원안)
2. NestJS + EJS/Handlebars 템플릿
3. **Next 16 App Router 사이드** (`apps/web` 신규)
4. Expo Web (RN-web으로 모바일 코드 재활용)
5. SvelteKit/Astro 별도 frontend

## 결정 (Decision)

**선택**: **Next 16 App Router 사이드 — `apps/web` 신규 + Vercel 배포 + shadcn/ui + Tailwind + react-query**.

## 이유 / 트레이드오프

### 왜 Next 16인가

- **풍부 UX 모바일 웹** — 본인 의도 정확 fit. Day One/Apple Photos 공유 페이지가 사실상 정답 형태.
- **참조 stack 정복 + 한 단계 앞** — 메모리 `관련 메모리`의 참조 stack은 Next 14 App Router + axios + react-query + Tailwind. Trailog Next 16 채택으로 **참조 패턴 일관 + 신버전 비교 학습**(App Router 안정화 / Server Actions / Turbopack default 등 변화 정복).
- **본인 자산 재활용** — Tailwind 디자인 토큰(Earthy Brown + Pretendard) + react-query + Zod 모바일과 통일. NativeWind 이미 정복(ADR-0011) → 웹 Tailwind는 거의 1:1 transfer.
- **shadcn/ui 컴포넌트** — 참조 패턴(Radix 기반) + Next App Router 최적화. 빠른 셋업 + a11y 기본.
- **공유 받은 사람 UX ↑** — 사진 그리드 + 미니맵 + 메타(한국어 주소) + 다운로드 + 비밀번호 입력 + 만료 안내 풍부.
- **Vercel 무료 한도 충분** — Next 16 최적화 + ISR/SSR + Image Optimization.

### 얻는 것

- 외부 사용자 풍부 UX (사진 + 메타 + 지도 + 다운로드)
- Next 16 신기능 정복 (App Router 안정화 / Turbopack default / Server Actions / PPR 등)
- 참조 Next 14 ↔ Trailog Next 16 한 단계 앞 비교 학습
- Trailog monorepo에 web 추가 — Phase 4+ 운영 진입 시 활용 가능 (관리 페이지 / 대시보드 등)

### 포기하는 것

- **작업 시간 ↑** — D6 1일 → D6abc 4일 (3일 추가). 단 학습 가치/UX 가치로 보상.
- **배포 인프라 추가** — Vercel 계정 + 도메인 연결. Phase 1 Fly.io + Phase 4 ECS 외에 Vercel도 운영 영역에 추가.
- **CORS 처리 필요** — 백엔드 NestJS에 `apps/web` origin 허용.
- **모바일 lib와의 일부 중복** — shares/photos/moments schemas는 web에서도 사용 → packages/shared로 추출 검토(Phase 후속).

### 학습 가치 관점

- **Next 16 App Router 깊이 정복** — 참조 Next 14 한 단계 앞. Server Components / Server Actions / parallel routes / intercepting routes 등 본격.
- **shadcn/ui 정복** — 참조 패턴(Radix) + Next 최적화 학습 노트.
- **Web → Mobile 비교** — NativeWind(mobile) ↔ Tailwind(web) 차이 박제. 메모리 `관련 메모리` 역방향(mobile → web) 자산 재활용.
- **Vercel 운영 영역** — 학습 우선순위 #1 인프라/배포 영역 확장.
- **모노레포 + Turbo 멀티 앱** — Phase 1 ADR-0001 모노레포 결정의 진가 — 3개 앱 동시 운영.

## 검토한 대안

| 대안                             | 장점                                    | 단점                                                                    | 제외 이유                                      |
| -------------------------------- | --------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------- |
| **A. Next 16 사이드** ⭐         | 풍부 UX + 참조 stack 정복 + 자산 재활용 | 작업 시간 ↑ + Vercel 추가 + CORS                                        | (채택)                                         |
| B. NestJS 인라인 HTML SSR (원안) | 가장 빠름                               | 빈약 UX + 본인 의도 fit X                                               | 본인 검토로 의도와 불일치                      |
| C. NestJS + EJS 템플릿           | 중간                                    | 템플릿 lib 학습 가치 ↓ + 풍부 UX 한계                                   | 학습 영역 fit X                                |
| D. Expo Web (RN-web)             | 모바일 코드 재활용                      | RN-web 한계(NaverMap web 호환성 검증 부담 + SEO 한계 + Vercel 최적화 X) | 한계 ↑. Next 16이 정답                         |
| E. SvelteKit/Astro               | 가벼움                                  | 참조 stack 불일치 + 정복 분산                                           | 의도적 다양화 over (Trailog는 React 정복 우선) |

## 결과 / 영향

### Trailog monorepo 구조

```
apps/
├── mobile/     # Expo (현재)
├── server/     # NestJS (현재)
└── web/        # Next 16 신규 (공유 페이지)
```

### 백엔드 (`apps/server/`)

- 신규 endpoint:
  - `GET /shares/public/:token` — 외부 사용자 (인증 X)
    - 만료/취소: 410/404
    - 비밀번호 보호: `{ requiresPassword: true }` 응답
    - 정상: photo/moment 데이터 + R2 presigned GET URL
  - `POST /shares/public/:token/unlock` — 비밀번호 검증 (bcrypt 비교)
    - 성공: 사진 데이터 응답
- CORS 활성 — `apps/web` origin 허용

### Web (`apps/web/`)

```
apps/web/
├── app/
│   ├── s/[token]/page.tsx       # 외부 진입점 (Server Component + 만료 분기)
│   ├── s/[token]/unlock/page.tsx # 비밀번호 입력 (Server Action)
│   └── layout.tsx
├── components/
│   └── ui/                      # shadcn/ui 컴포넌트
├── lib/
│   ├── api.ts                   # 백엔드 fetch wrapper
│   └── schemas.ts               # Zod schemas (모바일과 sync)
├── tailwind.config.ts           # 디자인 토큰 (모바일 mirror)
└── next.config.mjs
```

### 디자인 토큰 동기

- **colors**: Earthy Brown primary (50~900) + light/dark + semantic — 모바일 `tailwind.config.js` mirror
- **fontFamily**: Pretendard 4 weight (모바일과 동일 — Pretendard fonts 임베드)
- **fontSize / spacing / borderRadius**: 모바일 토큰 mirror

→ 모바일/웹 시각 일관 (사용자가 "같은 서비스"로 인지).

### 배포

- **Vercel** — Next 16 표준. 무료 한도 (100GB bandwidth / 100M requests / 무제한 builds).
- **도메인**: `trailog.app/s/{token}` (Phase 4 도메인 연결 시점)
- **개발**: 로컬 `localhost:3001` (백엔드 3000 + 모바일 8081 + web 3001)

### CORS

```typescript
// apps/server/src/main.ts
app.enableCors({
  origin: [
    'http://localhost:3001', // local web dev
    'https://trailog.app', // 운영 (Phase 4)
    'https://trailog-web.vercel.app', // 임시 Vercel default
  ],
});
```

### 추가 의존성

- `apps/web/` 신규 — `next@16.2.9` + `react@19` + `@tanstack/react-query@5` + `zod` + `tailwindcss` + `shadcn/ui` + `@mj-studio/naver-map-web` (검토)

## 재검토 트리거

- **Next 메이저 업데이트** (17+) — 점진 마이그레이션 또는 다음 메이저 채택
- **공유 페이지 사용량 급증** — Vercel 무료 한도 초과 시 Fly.io 또는 ECS로 이동
- **모바일 lib와의 중복** ↑ — `packages/shared` 추출 (schemas/types 공유)
- **NaverMap web SDK 호환성 문제** — Phase 4+ multi-provider 검토
- **SEO 필요** — Next의 metadata/sitemap 활용. 공유 페이지 indexing 정책 (default no-index 권장)

## 참고

- [Next 16 docs](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Vercel docs](https://vercel.com/docs)
- [Phase 3 Spec 5.1 D6](../specs/phase-03-sharing.md)
- [ADR-0011 NativeWind 디자인 시스템](./0011-mobile-design-system-nativewind.md) — 디자인 토큰 mirror 원본
- 참조 stack 메모리 — `관련 메모리` (Next 14 App Router + axios + react-query + Tailwind)
