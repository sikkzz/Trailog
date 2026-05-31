# ADR-0008: Zod 응답 검증 도입 (Phase 2 4.6)

> **상태**: Accepted (도입 시점: Phase 2 4.6)
> **날짜**: 2026-05-31
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [API Client 패턴 학습 노트](../learnings/api-client-patterns.md), [Phase 2 Spec 4.6](../specs/phase-02-core-features.md), [rn-mobile 룰](../../.claude/rn-mobile.md)

---

## 맥락 (Context)

Trailog 모바일 client는 백엔드 응답을 TypeScript interface로 캐스트 처리 (Phase 2 4.1~4.3). 컴파일 시점만 검증되고 **런타임 검증 X** — 백엔드 schema 변경 또는 버그로 다른 형태 응답 보낼 경우 모바일이 늦게 발견 (런타임 crash).

다른 NestJS 프론트 프로젝트(실측) 패턴은 **Zod schema parse**로 응답 런타임 검증:

```typescript
return this.fetch.get({
  url: 'find-user',
  validate: FindUserResponseSchema.parse, // ← 런타임 검증
});
```

Trailog 모바일도 같은 layer 도입 가치 명확. 단 **도입 시점**을 자연 통합 흐름에 맞추는 게 효율.

## 결정 (Decision)

**선택**: **Phase 2 4.6 (모바일 첫 화면) 진입 시점에 Zod 도입** + 동시 통합:

1. **백엔드 응답 검증** — `apiRequest` 결과를 `Schema.parse()` 처리
2. **단일 출처** — `z.infer<typeof Schema>` 로 TS 타입 자동 추론 (interface 제거)
3. **Form validation** — `react-hook-form` + `zodResolver` (로그인/회원가입 화면)
4. **React Query** — `useQuery` queryFn에 자연 통합

지금 Phase 2 4.3 D5의 `apps/mobile/src/lib/photos/` 와 4.1의 `auth-types.ts` 는 Phase 2 4.6 시점에 정정 (Schema 정의 + parse 박기).

## 이유 / 트레이드오프

### 얻는 것

- **런타임 응답 검증** — 백엔드 schema 변경 시 모바일 즉시 발견 (ZodError throw + 어느 필드가 어떻게 다른지 명시)
- **단일 출처** — Schema → 타입 자동 추론 → 백엔드 DTO와 sync 깨질 위험 ↓
- **Form validation** — react-hook-form + zodResolver = 모바일 로그인/회원가입/Moment 만들기 form 전부 동일 패턴
- **외부 API 응답 검증** — Phase 후속 OAuth (카카오/구글) / 지도 API 응답에도 적용
- **참조 패턴 정복** — 다른 NestJS 프론트 프로젝트 일관 패턴 학습
- **점진 도입 자연 시점** — 4.6에서 모바일 화면 본격 = 백엔드 호출 본격 = 검증 가치 즉시

### 포기하는 것

- **번들 사이즈** — Zod 약 50KB (모바일 영향 작음, gzip 후 ~20KB)
- **Parse 비용** — 매 응답마다 schema 검증 (작은 응답엔 무관, 큰 리스트는 측정 후 결정)
- **마이그레이션 작업** — 기존 interface → Schema 정정 (Phase 2 4.3 D5까지 작성된 lib 정정. 작은 양 — Photos lib + auth-types만)

### 학습 가치 관점

- **Zod 자체 학습** — 한국/글로벌 프론트 사실상 표준 (TanStack Query / Next.js / shadcn-ui 모두 권장)
- **z.infer 단일 출처 패턴 정복** — 참조 코드 일관 + 다른 사이드/포트폴리오 활용
- **`safeParse` vs `parse` 차이 + ZodError 활용** — 에러 메시지 UX 학습
- **단일 출처 일반화** — 백엔드 NestJS DTO → 모바일 Schema → 공유 packages/shared-types 확장 (Phase 후속)

## 검토한 대안

| 대안                           | 장점                                            | 단점                                                   | 제외 이유                                            |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------- |
| **A. Zod** (채택)              | 사실상 표준, react-hook-form/TanStack 통합 풍부 | 50KB bundle                                            | —                                                    |
| B. interface만 + 검증 X (현재) | 단순, bundle 0 추가                             | 런타임 안전 X — 백엔드 schema 변경 시 모바일 늦게 발견 | 위험 ↑, 참조 패턴과 불일치                           |
| C. Valibot                     | Zod 호환 API + 약 30KB (gzip 후 ~10KB)          | 신생 (2024 GA), 생태계 작음                            | 학습 단계엔 표준(Zod) 우선. 운영 진입 시 비교 가치   |
| D. Effect-TS Schema            | 함수형 effect system + 풍부한 검증              | 학습 곡선 ★★★ — 함수형 패러다임 깊이                   | 사이드엔 over-engineering. Phase 후속 깊이 정복 가능 |
| E. tRPC (백엔드 정정)          | end-to-end 타입 자동, 런타임 검증 자동          | NestJS controller 전면 정정 + 학습 곡선                | Trailog는 REST 기반 결정 — Phase 후속 비교 학습 가치 |

## Trailog 도입 패턴 (Phase 2 4.6 시점)

### 1. 응답 Schema 정의

```typescript
// apps/mobile/src/lib/photos/photos-schemas.ts (Phase 2 4.6)
import { z } from 'zod';

export const CreateUploadUrlResponseSchema = z.object({
  photoId: z.string().uuid(),
  key: z.string(),
  presignedUrl: z.string().url(),
  contentType: z.string(),
});

export const ConfirmPhotoResponseSchema = z.object({
  id: z.string().uuid(),
  momentId: z.string().uuid(),
  originalKey: z.string(),
  createdAt: z.string().datetime(),
});

export const PhotoListItemSchema = z.object({
  id: z.string().uuid(),
  momentId: z.string().uuid(),
  originalKey: z.string(),
  originalUrl: z.string().url(),
  createdAt: z.string().datetime(),
});

export const GetPhotosResponseSchema = z.object({
  photos: z.array(PhotoListItemSchema),
});

// 타입 단일 출처
export type CreateUploadUrlResponse = z.infer<typeof CreateUploadUrlResponseSchema>;
// ... 나머지도 z.infer
```

### 2. API 호출에 parse 박기

```typescript
export async function createPresignedUploadUrl(momentId, ext) {
  const raw = await apiRequest<unknown>(`/moments/${momentId}/photos/upload-url`, ...);
  return CreateUploadUrlResponseSchema.parse(raw);
  // 스키마 안 맞으면 ZodError throw → 모바일 즉시 인지
}
```

### 3. Form validation 통합 (4.6 로그인/Moment 만들기 화면)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const SignInFormSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

function SignInScreen() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(SignInFormSchema),
  });
  // ...
}
```

### 4. RestResponse 구조 검증 (자동 unwrap에 통합)

```typescript
// api-client.ts (4.6 정정)
const RestResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    type: z.enum(['SUCCESS', 'ERROR']),
    code: z.string(),
    data: dataSchema.nullable(),
    message: z.string().nullable(),
    status: z.number(),
    method: z.enum(['NONE', 'LOG_OUT', 'LOGIN_REQUIRED', 'BLOCKED']),
  });

// 사용:
const wrapper = RestResponseSchema(CreateUploadUrlResponseSchema);
const validated = wrapper.parse(rawResponse);
return validated.data;
```

## 결과 / 영향

### 구조 변경 (Phase 2 4.6 시점)

- 의존성 추가: `zod`, `@hookform/resolvers`, `react-hook-form`
- `apps/mobile/src/lib/*/schemas.ts` — 도메인별 schema 파일 신규
- 기존 `*-types.ts` interface는 schema의 `z.infer` 결과로 통합 (단일 출처)
- `apps/mobile/src/lib/auth/api-client.ts` — RestResponseSchema generic helper
- 화면별 form — react-hook-form + zodResolver

### Phase 2 4.3 까지 작성된 lib 정정 범위 (4.6 시점)

```
apps/mobile/src/lib/photos/
  photos-types.ts → photos-schemas.ts (Schema 정의 + z.infer 타입)
  photos-api.ts   → parse 박기 (4 메서드)

apps/mobile/src/lib/auth/
  auth-types.ts   → auth-schemas.ts (RestResponse + ApiError 외 추가)
  api-client.ts   → executeRequest의 isRestResponse를 schema parse로
```

### 비용 영향

- Bundle 추가: ~50KB (gzip ~20KB) — 모바일 사용자엔 무관
- Parse 비용: 응답 크기에 따라 다름. 일반 응답 ms 단위. 큰 리스트 응답은 측정 후 결정.

## 자체 구현 옵션 — 엔터프라이즈/온프레미스 컨텍스트 검토

본 ADR은 **사이드 + 학습 컨텍스트**에서 Zod 채택. 그러나 다음 상황에선 자체 구현
재검토 가치 있음 — 본인 실무 실무 운영 서비스 컨텍스트 반영.

### 자체 구현 합리한 컨텍스트

| 컨텍스트                                            | 사유                                |
| --------------------------------------------------- | ----------------------------------- |
| 수십~수백 endpoint + 보안 critical (금융/군사/항공) | 라이브러리 audit 부담 ↑↑ — ROI 역전 |
| 공급망 보안 매우 엄격 (의료/국방/공공기관 납품)     | npm 패키지 탈취 위험 0 필수         |
| 번들 사이즈 critical (광고 SDK, 위젯, AMP)          | KB 단위 다툼                        |
| 실무 표준 wrapper (RestAPIInstance 같은)            | 인증/로깅/감사 통합 — 도메인 특화   |

### Zod 자체 구현 비용 추정

```
기본 (primitives + object + optional)    : 16시간
점진 (refinement / transform / 등)        : 30~50시간
완전 동등성                              : 사실상 불가능 (Zod 자체 수년간 진화)
유지보수                                  : 본인/팀 책임
TypeScript 타입 추론 (z.infer 동등)        : 매우 어려움 (Zod 내부 모방)
```

### 실제 큰 기업들 패턴

검증 라이브러리(Zod 같은 일반 검증)는 **거의 자체 구현 X**. 대신:

- 자체 framework wrapper (참조 RestAPIInstance, 참조 fetch)
- 비즈니스 도메인 logic (참조 도메인 service)
- 보안 critical layer (자체 인증/감사)

Meta(React), Google(Closure), Stripe(자체 SDK), Netflix(자체 gateway) 모두 표준
라이브러리 사용 + 도메인 특화 자체 구현 패턴.

### Trailog 결정 유지 사유

| 사유                            | 영향                                   |
| ------------------------------- | -------------------------------------- |
| 사이드 + 학습 컨텍스트          | 라이브러리 시간 효율 압도              |
| 1인 개발                        | bus factor 1 — 자체 구현 유지보수 부담 |
| 모바일 번들 영향 작음           | Zod 50KB 무관                          |
| Audit 안 함                     | 사이드 — 보안 audit 프로세스 X         |
| React Hook Form / TanStack 통합 | Zod 표준 — 통합 풍부                   |
| 학습 가치 (Zod 정복)            | 참조 코드 일관 + 표준 학습             |

### 본인 실무 컨텍스트 (별도 학습 가치)

production 도입 X — **학습 PoC 가치**:

- 사내 라이브러리 audit 프로세스 검토 PR (보안팀 협업 학습)
- mini-validator 자체 구현 PoC (라이브러리 내부 정복)
- 참조 도메인 특화 자체 wrapper PR 시도
- 포트폴리오/포트폴리오 시그널 — "라이브러리 trade-off 이해 + 자체 구현 정복"

## 재검토 트리거

- **Phase 2 4.6 진입 시점** — 본 ADR 실행 (Schema 정의 + parse + form validation 한 번에)
- **Valibot 표준화 시점** — Zod 대안. 2027+ 운영 진입 시점에 비교 가능
- **번들 사이즈 50KB+ 문제** — 모바일에서 영향 작지만 Phase 4 웹 동봉 시 검토
- **tRPC 도입 시점** — 백엔드 NestJS controller 전면 정정 결정 시 자동 타입으로 대체 가능

## 참고

- [Zod 공식 문서](https://zod.dev/)
- [@hookform/resolvers + Zod](https://react-hook-form.com/get-started#SchemaValidation)
- [TanStack Query + Zod 통합 패턴](https://tanstack.com/query/latest/docs/framework/react/guides/queries)
- [API Client 패턴 학습 노트](../learnings/api-client-patterns.md)
- [Valibot — Zod 대안](https://valibot.dev/)
