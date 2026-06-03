# Zod 런타임 검증 + z.infer 단일 출처 + Form UX

> **작성일**: 2026-06-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #2 type-safety/runtime contract (PROJECT_ROOT 2장 보조)
> **관련 문서**: [ADR-0008 Zod 응답 검증](../decisions/0008-zod-response-validation.md), [Phase 2 Spec 4.6](../specs/phase-02-core-features.md), [TypeScript Strict 모드](typescript-strict-mode.md)

---

## 한 줄 요약

**Zod** = TS와 동기화된 schema 라이브러리. `z.object({ ... })` 정의 → `z.infer<typeof Schema>`로 타입 자동 추론(단일 출처) + `Schema.parse(unknown)`으로 런타임 검증. **백엔드 응답 검증 + Form validation 둘 다 같은 schema**로 처리 — Trailog의 ADR-0008 핵심 패턴.

## 우리 프로젝트에서 어디에 쓰이는가

Phase 2 4.6에 적용:

| 영역            | Schema                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Auth lib 응답   | `SignInResponseSchema`, `SignUpResponseSchema`, `TokenPairSchema`                                   |
| Moments lib     | `MomentSchema`, `CreateMomentRequest/Response`, `GetMomentsResponseSchema`                          |
| Photos lib      | `PhotoListItemSchema`, `CreateUploadUrlResponse`, `ConfirmPhotoResponse`, `GetPhotosResponseSchema` |
| Form validation | RHF `zodResolver(SignInRequestSchema)`, `useForm<SignInRequest>`                                    |

## 어떻게 동작하는가

### Schema 정의

```tsx
import { z } from 'zod';

export const SignInRequestSchema = z.object({
  email: z.string().email('이메일 형식이 올바르지 않습니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
});

// 자동 타입 추론 (인터페이스 X)
export type SignInRequest = z.infer<typeof SignInRequestSchema>;
//  ↳ { email: string; password: string }
```

**핵심**:

- **단일 출처** — Schema 변경 → 타입 자동 반영 (인터페이스 별도 유지 X)
- **에러 메시지** — Schema 정의 시 같이 박음 (i18n 시점에 분리)

### 런타임 검증 — `Schema.parse(unknown)`

```tsx
// API 응답 — apiRequest는 unknown 반환
const data = await apiRequest('/auth/sign-in', { method: 'POST', body });
const tokens = SignInResponseSchema.parse(data);
//    ↑ 백엔드 schema 변경 시 즉시 ZodError throw (필드 누락/타입 불일치 등)
```

`.parse()` vs `.safeParse()`:

- **`.parse()`** — 실패 시 throw — try/catch 또는 mutation onError로 잡음
- **`.safeParse()`** — `{ success: true, data } | { success: false, error }` 반환 — 명시적 분기

Trailog는 주로 `.parse()` — try/catch + Alert로 사용자에게 일반화 메시지.

### Form validation — RHF + zodResolver

```tsx
import { zodResolver } from '@hookform/resolvers/zod';

const {
  control,
  handleSubmit,
  formState: { errors, isSubmitting },
} = useForm<SignInRequest>({
  resolver: zodResolver(SignInRequestSchema),
  defaultValues: { email: '', password: '' },
});

const onSubmit = async (form: SignInRequest) => {
  // form은 schema 통과한 valid 데이터
  const data = await apiRequest('/auth/sign-in', { method: 'POST', body: form });
  // ...
};
```

`handleSubmit(onSubmit)` 호출 시:

1. 모든 field에 schema 적용
2. **invalid면 onSubmit 호출 X + errors state 박음**
3. valid면 onSubmit(form) 호출

`errors.email.message` 등 schema에 박은 에러 메시지 직접 사용:

```tsx
{
  errors.email && <Text style={styles.error}>{errors.email.message}</Text>;
}
```

## 핵심 개념

### z.infer — 단일 출처

```tsx
// 1. Schema 정의 (런타임 + 빌드타임 둘 다)
const UserSchema = z.object({ id: z.string(), name: z.string() });

// 2. 타입은 자동 추론
type User = z.infer<typeof UserSchema>;
//   ↳ { id: string; name: string }

// 3. 사용
const user: User = UserSchema.parse(apiResponse);
```

**왜 단일 출처가 중요**:

- 인터페이스 + Schema 별도 유지 시 **둘이 어긋날 수 있음** — Schema는 string인데 인터페이스는 number 같은 버그
- `z.infer`로 추론하면 절대 어긋나지 않음

### 백엔드 ↔ 모바일 contract 안전

Trailog backend NestJS DTO → 모바일 Zod Schema → z.infer 타입.

```
백엔드 변경 (예: PhotoListItem에 새 field 추가)
   ↓
모바일 Schema 정정 (수동 — 이건 packages/shared-types로 자동화 가능 후속)
   ↓
타입 자동 반영 (z.infer)
   ↓
parse() 호출 시 즉시 ZodError if 백엔드 응답 잘못됨 (런타임 contract)
```

**4.4 D3c에서 thumbnailUrls 추가**, **4.5 D3에서 takenAt/location 추가** — 모바일 Schema에 명시적 sync 필요. 잊으면 parse 실패로 즉시 detect.

### 백엔드 RestResponse unwrap

Trailog apiRequest는 RestResponse의 `data`만 unwrap → 호출자에 unknown으로 반환:

```tsx
const data: unknown = await apiRequest('/auth/sign-in', { ... });
// data: 'data' field만 (백엔드 RestResponse.data)

const tokens = SignInResponseSchema.parse(data);
```

RestResponse의 메타(`type`, `code`, `status`, `method`)는 apiRequest 안에서 처리 (ApiError throw + method enum 자동 액션).

### Form validation 한국어 메시지

zod 기본 에러 메시지는 영어. Trailog는 schema 정의에 한국어 직접 박음:

```tsx
z.string().email('이메일 형식이 올바르지 않습니다');
z.string().min(8, '비밀번호는 8자 이상이어야 합니다');
z.string().datetime({ offset: true }); // 이건 기본 'Invalid datetime' 표시
```

대안 — `z.setErrorMap()`으로 전역 한국어 에러 맵 박기 (Phase 후속).

### ZodError 구조

```json
[
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["accessToken"],
    "message": "Required"
  }
]
```

- **path** — 어느 필드가 문제인지 (중첩 시 배열)
- **message** — schema에 박은 또는 zod 기본 메시지
- **code** — `invalid_type` / `too_small` / `invalid_string` 등

사용자에게는 일반화 메시지 (`'요청 처리 중 오류'`)만 표시, 개발자에겐 console.error로 path/message 박음.

## 참조 패턴 비교

참조 (Next + Zod):

```tsx
const formSchema = z.object({
  name: z.string({ required_error: '2FA 이름을 입력해주세요.' }).min(1, '...'),
  isPrimary: z.boolean().default(false),
});
type FormValues = z.infer<typeof formSchema>;

const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: { ... },
});
```

| 항목              | 참조                                 | Trailog                                   |
| ----------------- | ------------------------------------ | ----------------------------------------- |
| z.infer           | ✅                                   | ✅                                        |
| zodResolver + RHF | ✅                                   | ✅                                        |
| Form UI           | shadcn `<FormField>` (Radix wrapper) | RHF `Controller` 직접 (모바일 — shadcn X) |
| Schema 위치       | form 컴포넌트 안                     | lib/auth/auth-schemas.ts 분리 (재사용)    |
| 응답 검증         | ✅ (다른 NestJS 프로젝트 패턴)       | ✅ ADR-0008 정착                          |

→ 핵심 패턴 동일. Trailog는 schema를 lib에 분리 (도메인 단일 출처 강조).

## 흔한 함정

1. **interface와 Schema 별도 유지** — 단일 출처 깨짐. 항상 `z.infer` 사용.
2. **`.parse()` 실패 처리 누락** — 백엔드 schema 변경 시 모바일 crash. try/catch + Alert.
3. **에러 메시지 i18n 미준비** — schema에 한국어 직접 박으면 다국어 시 정정 비용.
4. **Schema 정의 시 default 값과 type 불일치** — `z.boolean().default(false)`가 타입에서 optional 됨 — 주의.
5. **datetime validation** — `z.string().datetime({ offset: true })`는 ISO + offset 필수. 빈 string 받으려면 `.optional()` 또는 빈 처리 분리.
6. **transform / refine 과용** — 복잡해짐. 단순 validation은 zod 기본 메서드로 충분.
7. **Form errors와 schema parse 에러 혼동** — RHF의 errors는 form, parse 에러는 응답. 분리 처리.
8. **`undefined` vs `null`** — z.string().optional() vs z.string().nullable() 다름. 응답 null 받으면 nullable.
9. **Schema 깊이 너무 깊음** — 자주 변경되는 응답엔 부담. unknown 또는 partial schema 검토.
10. **번들 사이즈** — Zod ~50KB. 모바일엔 미미하지만 의식 학습.

## 더 파볼 거리

- **`z.setErrorMap` 전역 한국어** — i18n 정착
- **valibot** — Zod 대안 (더 작고 trees-shakable)
- **shared-types 패키지** — `packages/shared-types`로 백엔드 NestJS DTO ↔ 모바일 Zod 자동 sync
- **OpenAPI → Zod 자동 생성** — `openapi-zod-client` / `swagger-to-zod`
- **`z.discriminatedUnion`** — type field로 분기하는 응답 (RestResponse의 type=SUCCESS/ERROR 같은)
- **Schema versioning** — 백엔드 v1/v2 분기 처리
- **Performance — 큰 응답 parse 비용** — 측정 후 partial schema 또는 unknown 캐스트

## 참고 링크

- [Zod 공식](https://zod.dev/)
- [@hookform/resolvers/zod](https://github.com/react-hook-form/resolvers#zod)
- [TkDodo's Effective React Query (Schema 검증 부분)](https://tkdodo.eu/blog)
- [ADR-0008 Zod 응답 검증 도입](../decisions/0008-zod-response-validation.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
