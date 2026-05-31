# API Client 패턴 — Class vs 함수 + Zod 응답 검증

> **작성일**: 2026-05-31
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 코드 품질 + 통신 안전성 (PROJECT_ROOT 외 일반)
> **관련 문서**: [ADR-0008 Zod 응답 검증 도입](../decisions/0008-zod-response-validation.md), [rn-mobile 룰](../../.claude/rn-mobile.md), [jwt-auth-and-refresh-rotation](./jwt-auth-and-refresh-rotation.md)

---

## 한 줄 요약

API client는 **그룹화 방식(Class vs 함수) + 응답 검증(Zod 등)** 두 layer로 나뉜다.
프론트 트렌드는 함수형 + Zod 응답 검증 — Trailog 모바일은 함수형 채택, Zod는 Phase 2 4.6에 React Query + React Hook Form과 함께 도입.

## 우리 프로젝트에서 어디에 쓰이는가

- **Trailog 모바일** (`apps/mobile/src/lib/`):
  - `auth/api-client.ts` — 전역 `apiRequest` fetch wrapper (Phase 2 4.1)
  - `photos/photos-api.ts` — Photos API helpers (Phase 2 4.3 D5)
  - Zod 응답 검증은 **Phase 2 4.6에 도입** (ADR-0008)
- **다른 NestJS 프론트 프로젝트** (비교 컨텍스트):
  - Class 기반 API service + `Schema.parse(response)` Zod 검증

## API Client 그룹화 — Class vs 함수

### Class 기반 (참조 패턴 — 실측)

```typescript
// 1. Class 선언 (도메인별)
export class UserAPIService {
  constructor(private fetch: RestAPIProtocol) {}

  findUsers(searchTerm: string) {
    return this.fetch.get({
      url: 'find-user',
      query: { 'search-term': searchTerm },
      validate: FindUserResponseSchema.parse,  // Zod 검증
    });
  }

  checkNickname(nickname: string) { ... }
}

// 2. Singleton instance (DI 패턴)
export const userAPIService = new UserAPIService(
  generateRestAPI({ baseURL: 'user' }, ...)
);

// 3. 사용처
import { userAPIService } from '@/service';
userAPIService.findUsers('foo');
```

**특징**:

- 도메인별 class 그룹화
- Constructor DI — fetch wrapper + config 받음
- Singleton instance 전역 import
- baseURL 한 곳

### 함수 기반 (Trailog 채택)

```typescript
// apps/mobile/src/lib/photos/photos-api.ts
export async function createPresignedUploadUrl(...) {
  return apiRequest<CreateUploadUrlResponse>(...);
}
export async function uploadPhotoToR2(...) { ... }
export async function uploadPhoto(...) { ... }  // high-level

// 사용처
import { uploadPhoto } from '@/lib/photos';
await uploadPhoto(momentId, blob, 'jpg');
```

**특징**:

- 함수 단위 export
- 도메인 그룹화는 폴더 + barrel
- `apiRequest` 전역 import (암묵 의존)
- React Query queryFn에 직접 사용 자연

### 비교 표

| 영역                 | Class 기반                  | 함수 기반               |
| -------------------- | --------------------------- | ----------------------- |
| 그룹화               | class 내부 메서드           | barrel export           |
| 의존성 주입          | constructor 명시            | 전역 import             |
| baseURL              | class당 1개                 | path 직접 박음          |
| Tree shaking         | ❌ class 전체 박힘          | ✅ 함수 단위 제거       |
| 테스트               | mock service class          | jest.mock 함수/모듈     |
| React/RN 친화        | Context or singleton        | useQuery/useEffect 자연 |
| boilerplate          | class + DI + singleton 셋업 | 함수 export만           |
| OOP 학습 곡선        | ⬆️ DI/singleton 이해        | ⬇️                      |
| NestJS 백엔드와 일관 | ✅                          | ❌                      |
| 참조 프론트와 일관   | ✅                          | ❌                      |

## React 생태계 트렌드 (2026)

**프론트는 함수형 강세**:

- React Hooks 이후 모든 트렌드가 함수형
- Next.js App Router (Server/Client Component 모두 함수)
- **TanStack Query** — `useQuery({ queryFn: () => fetch... })` 함수 받음
- tRPC — Procedure-based (함수)
- Zustand / Jotai — 함수형 store

**Class 강세 영역** (백엔드):

- NestJS, Angular, Spring — Class + DI 표준
- 의존성 그래프 명시적

→ **프론트 = 함수, 백엔드 = Class**가 2026 표준.

## Zod 응답 검증 — 별개 layer

**Class vs 함수와 무관한 layer**. 데이터 통신 안전성 layer.

### Zod 없을 때 (Trailog 현재)

```typescript
export async function createPresignedUploadUrl(...) {
  return apiRequest<CreateUploadUrlResponse>(...);  // TS interface 캐스트만
  // ↑ 컴파일 시점만 검증. 런타임 백엔드가 다른 형태 응답 보내도 모름.
}

// 위험: 백엔드 schema 변경 → 모바일이 런타임에 undefined.foo crash
```

### Zod 있을 때 (참조 패턴 + Phase 2 4.6 도입 예정)

```typescript
import { z } from 'zod';

const CreateUploadUrlResponseSchema = z.object({
  photoId: z.string().uuid(),
  key: z.string(),
  presignedUrl: z.string().url(),
  contentType: z.string(),
});

// 단일 출처 — schema에서 타입 자동 추론
type CreateUploadUrlResponse = z.infer<typeof CreateUploadUrlResponseSchema>;

export async function createPresignedUploadUrl(...) {
  const response = await apiRequest<unknown>(...);
  return CreateUploadUrlResponseSchema.parse(response);
  // 스키마 안 맞으면 ZodError throw → 즉시 발견
}
```

### Zod의 4가지 가치

| 가치                    | 설명                                                     | Trailog 적용 시점      |
| ----------------------- | -------------------------------------------------------- | ---------------------- |
| **백엔드 응답 검증**    | `Schema.parse(response)` — 런타임 형태 보장              | Phase 2 4.6 (ADR-0008) |
| **타입 추론 단일 출처** | `z.infer<typeof Schema>` — schema 변경 시 타입 자동 sync | Phase 2 4.6            |
| **Form validation**     | `react-hook-form` + `zodResolver`                        | Phase 2 4.6            |
| **외부 API 응답**       | OAuth, 지도 API 등                                       | Phase 후속 (Phase 3+)  |

### 웹/앱 무관

Zod는 데이터 layer — JSON 응답 검증. 웹/RN/Node 다 동일하게 동작. **Class/함수 무관**.

## Trailog 결정 매트릭스

| 결정              | 선택            | 사유                                                                                   |
| ----------------- | --------------- | -------------------------------------------------------------------------------------- |
| Class vs 함수     | **함수**        | React/RN 생태계 표준 + React Query 자연 통합 + tree shaking                            |
| 참조 패턴 (Class) | **거부**        | 의도적 다양화 — 참조 axios+class → 사이드 fetch+함수 (TypeORM의 "친숙→정복" 반대 전략) |
| Zod 응답 검증     | **채택**        | 런타임 안전성 — class/함수 무관                                                        |
| Zod 도입 시점     | **Phase 2 4.6** | React Query + React Hook Form + zodResolver 한 번에 자연 통합                          |
| 단일 출처         | **z.infer**     | schema 변경 시 타입 자동 sync                                                          |

## 함정 / 주의할 점

### 1. Class 기반 — Singleton import의 함정

```typescript
// ⚠️ Singleton이 환경별 config를 받지 못하면 dev/prod 분기 어려움
export const userAPIService = new UserAPIService(
  generateRestAPI({ baseURL: 'user' }, false, CONFIG.API_V2_URL, false),
);
```

해결: 환경변수 + lazy initialization 또는 factory 패턴.

### 2. 함수 기반 — `apiRequest` 암묵 의존

```typescript
// ⚠️ photos-api 함수가 apiRequest를 직접 import — 테스트 시 jest.mock 모듈 단위
import { apiRequest } from '../auth';
```

해결:

- jest.mock 모듈 mock (단순)
- 또는 dependency injection 함수 인자로 받기 (테스트 친화, boilerplate 증가)

### 3. Zod parse 실패 시 처리

```typescript
try {
  return Schema.parse(response);
} catch (error) {
  if (error instanceof z.ZodError) {
    // 어느 필드가 어떻게 다른지 명확 (error.issues)
    console.error('Schema mismatch:', error.issues);
  }
  throw error;
}
```

→ 백엔드 schema 변경 시점에 모바일 즉시 발견. 빨리 발견 > 늦게 발견.

### 4. Zod parse 비용 (성능)

매 응답마다 parse — 작은 비용이지만 큰 리스트 응답엔 검토.

해결:

- `Schema.safeParse(response)` — throw 안 함, 결과 객체 (분기 처리 가능)
- 매우 큰 리스트는 `z.array(ItemSchema).parse(response.items)` 외 다른 필드는 일반 cast

### 5. 타입 vs Schema 단일 출처 위반

```typescript
// ⚠️ 안티 패턴 — interface 따로, Schema 따로
interface User {
  id: string;
  name: string;
}
const UserSchema = z.object({ id: z.string(), name: z.string() });
// ↑ 두 곳에서 변경 동기화 필요 (실수 가능)

// ✅ Schema 단일 출처
const UserSchema = z.object({ id: z.string(), name: z.string() });
type User = z.infer<typeof UserSchema>;
```

### 6. Class vs 함수 결정의 약점 — 실제 차이 작음

대부분의 경우 둘 다 동작. **정말 큰 차이는 React Query 통합 + tree shaking 정도**. 의도적 결정이 아니라면 generation 트렌드 따라 함수형 권장.

## 엔터프라이즈/온프레미스 — 라이브러리 vs 자체 구현 ROI

실무 운영 서비스(특히 온프레미스 대기업 납품)에선 라이브러리 자체가 비용. 본인 직감 정확.

### 라이브러리의 진짜 비용 (7 항목)

| 비용          | 영향                                              |
| ------------- | ------------------------------------------------- |
| 번들 사이즈   | Zod ~50KB. 누적되면 KB → MB. 모바일/저사양 영향   |
| License audit | MIT/Apache/BSD/GPL 검토. GPL은 종속 위험          |
| CVE check     | Common Vulnerabilities — 라이브러리마다 추적      |
| 공급망 보안   | npm 패키지 탈취 (event-stream, ua-parser-js 사건) |
| 간접 의존성   | 의존성 그래프 N개 (Zod는 예외적으로 0 sub-dep)    |
| 유지보수      | deprecation / 메이저 업그레이드 부담              |
| 납품 검토     | 보안팀 audit N시간 — 라이브러리마다 누적          |

### 자체 구현이 **진짜 가치 있는** 경우

| 컨텍스트                               | 사유                                                        |
| -------------------------------------- | ----------------------------------------------------------- |
| **수십~수백 endpoint + 보안 critical** | 라이브러리 audit 부담 ↑↑ → ROI 역전. 금융/군사/항공         |
| **공급망 보안 매우 엄격**              | npm 탈취 위험 0 필수. 의료/국방/공공기관 납품               |
| **번들 사이즈 critical**               | 광고 SDK, 위젯, AMP — KB 단위 다툼                          |
| **특수 도메인 요구**                   | 일반 라이브러리로 표현 불가. 게임 엔진, 비디오 코덱, 암호화 |
| **실무 표준 wrapper**                  | 자체 인증/로깅/감사 통합 — 참조 RestAPIInstance 같은        |

### 자체 구현이 **가치 없는** 경우

| 컨텍스트                  | 사유                                            |
| ------------------------- | ----------------------------------------------- |
| 사이드 + 학습 + 소규모    | 라이브러리 시간 우위 압도. 자체 구현 = 기회비용 |
| 일반적 사용 패턴          | Zod/Lodash 충분. 재발명 부담 큼                 |
| 팀 규모 작음              | 유지보수 부담 ↑ — bus factor 1                  |
| 빠른 출시 우선            | 자체 구현 시간 = 출시 지연                      |
| TypeScript 타입 추론 의존 | Zod의 핵심 가치 — 직접 구현 매우 어려움         |

### Zod 자체 구현 시 시간 시뮬레이션

```
Primitives + composite              : 1~2시간
Optional/Nullable                   : 2시간
Refinement (.refine())              : 4시간
Transformation (.transform())       : 4시간
Discriminated unions                : 6시간 (타입 추론 복잡)
Branded types                       : 4시간
Recursive schemas                   : 8시간+ (TS circular type)
Lazy schemas                        : 8시간+
Async validation                    : 8시간+
ZodError introspection              : 10시간+ (path tracking)
React Hook Form resolver            : 6시간+ (RHF 인터페이스 학습)
Edge cases (수년간 발견)             : 무한 (Zod 4.x까지 메이저 6번)
```

**기본** = 16시간. **완전 동등성** = 사실상 불가능 (Zod 자체가 수년간 진화).

### TypeScript 타입 추론 — Zod의 핵심 가치

```typescript
const Schema = z.object({
  name: z.string(),
  age: z.number(),
  tags: z.array(z.string()),
  profile: z.object({ avatar: z.string().url().optional() }),
});
type T = z.infer<typeof Schema>;
// → 자동 추론: { name: string; age: number; tags: string[]; profile: { avatar?: string } }
```

자체 구현으로 같은 타입 자동 추론 = 매우 복잡한 conditional type + recursive infer. 결국 Zod 내부 모방.

### 실제 큰 기업들 — 어떻게 하는가

| 참조            | 자체 구현                        | 라이브러리                   |
| --------------- | -------------------------------- | ---------------------------- |
| **Meta**        | Flow (자체 타입), React, Relay   | Lodash, Express              |
| **Google**      | Closure Library, gRPC            | TypeScript, React            |
| **Stripe**      | 자체 SDK + 자체 schema validator | 표준 (axios 등)              |
| **Netflix**     | 자체 GraphQL gateway, 자체 fetch | RxJS, Lodash                 |
| **한국 대기업** | 실무 표준 wrapper + 자체 utility | 표준 (React/Lodash/axios 등) |

→ **검증 라이브러리(Zod 같은 거)는 거의 자체 구현 X**. 자체 구현 영역은 비즈니스 로직 + framework wrapper + 도메인 특화.

→ **표준 라이브러리는 큰 기업도 사용** (단 audit + whitelist + 일부 fork).

### ROI 종합 — 사이드 + 실무

**Trailog 사이드 ROI**:

```
자체 구현 비용: 초기 16시간 + 점진 N + 유지보수 본인 책임 + 버그 본인 책임
자체 구현 가치: 번들 ~50KB 절약(모바일 무관) + audit 절약(사이드 무관) + 학습 가치
→ 학습 가치만 ↑, 실용 가치 ↓
→ Zod 채택 OK
```

**실무 운영 서비스 ROI**:

```
일반 도메인:
  자체 구현 비용 > 라이브러리 비용 → 표준 라이브러리 채택
보안 critical (금융/의료/공공/온프레미스):
  라이브러리 audit 부담 > 자체 구현 비용 → 자체 구현 합리
  단 Zod 같은 검증 layer는 audit + whitelist 통과 가능
도메인 특화 (실무 표준 wrapper):
  자체 구현이 정답 (RestAPIInstance, 참조 fetch 등)
```

### 진짜 학습 가치 — 자체 구현 시도 자체

production 도입 X. **학습 목적 자체 구현**:

1. **라이브러리 내부 동작 정복** — TypeORM의 "친숙 → 정복" 패턴
2. **별도 브랜치/사이드 프로젝트** 시도
3. **본인 한계 시도** — 어디까지 자체 구현 가능한지 (TS 타입 추론 어디서 막히는지)
4. **참조 코드 이해 ↑** — 참조 wrapper/utility 깊이
5. **시니어 시그널** — "라이브러리 내부 동작 정복 + 의사결정 트레이드오프 이해"

### 한 줄 결론

```
사이드 + 학습:               라이브러리 사용 + 별도 브랜치/repo로 자체 구현 학습 시도
실무 + 일반 도메인:           표준 라이브러리 + 사내 audit 프로세스
실무 + 보안 critical:        자체 구현 합리 (금융/의료/공공/온프레미스)
실무 + 참조 wrapper:         자체 구현 정답 (도메인 특화)
```

## 더 파볼 거리

- **참조 class 패턴 직접 모방 PR** — Trailog에 별도 브랜치로 class 기반 정정 시도 → 두 패턴 직접 체험. 학습 가치 ↑
- **tRPC** — TypeScript end-to-end type-safety. 백엔드 procedure → 프론트 자동 타입. NestJS와 통합 가능 (`@nestjs/trpc`)
- **OpenAPI/Swagger → 타입 자동 생성** — `openapi-typescript-codegen`. Swagger를 단일 출처로
- **GraphQL + codegen** — schema-first → 백엔드/프론트 자동 타입
- **packages/shared-types/** 모노레포 패턴 — 백엔드 DTO export → 프론트 import (Phase 2 4.6 검토)
- **Effect-TS** — 함수형 effect system. Zod 대체 + 더 풍부한 검증
- **Valibot** — Zod 대안, 더 작은 bundle (~30KB vs Zod 50KB+)

## 참고 링크

- [Zod 공식 문서](https://zod.dev/)
- [TanStack Query queryFn 패턴](https://tanstack.com/query/latest/docs/framework/react/guides/queries)
- [tRPC 공식 문서](https://trpc.io/)
- [Valibot — Zod 대안](https://valibot.dev/)
- [Effect-TS — 함수형 effect system](https://effect.website/)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

### 2026-05-31 초안 — 본인 질문에서 파생

- Phase 2 4.3 D5 모바일 lib 작성 후 참조 패턴(class) vs Trailog 함수형 비교 질문
- 또 Zod 응답 검증 도입 가치 — Phase 2 4.6 자연 통합 결정 (ADR-0008)
- 4.6에서 실제 도입 후 추가 학습 누적 예정 (Zod schema 파일 구조, parse 비용 측정, ZodError 표시 UI 등)
