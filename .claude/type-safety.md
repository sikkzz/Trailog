# TypeScript 타입 안전성 가이드 (공통)

백엔드 + 모바일 모두 strict 모드. 이 룰은 양쪽 다 적용.

## 핵심 원칙

- **`any` 금지** — 모를 때는 `unknown` + 타입 가드.
- **타입 어서션(`as Type`) 최소화** — 불가피 시 이유 주석.
- **DTO/엔티티 타입은 단일 출처** — 백엔드는 NestJS DTO class (class-validator), 모바일은 백엔드 DTO에 맞춘 interface/type (Phase 후속 자동 sync 검토).
- **`any`가 쓰이는 곳 대부분은 제네릭 또는 타입 가드로 해결**.

## `any` 제거 패턴

| 상황                         | 해결                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| 외부 입력 / API 응답         | `unknown` + 타입 가드 함수 (`isXxx(x): x is Xxx`)                                   |
| 이벤트 핸들러 (React Native) | `GestureResponderEvent`, `NativeSyntheticEvent<T>` 등 구체                          |
| 범용 함수                    | 제네릭 `<T>`                                                                        |
| 여러 가능성                  | 리터럴 유니온 (`'pending' \| 'done' \| 'failed'`)                                   |
| 상태 분기                    | Discriminated Union (`{ status: 'ok'; data } \| { status: 'err'; error }`)          |
| `catch (error)`              | `unknown` (TS 4.4+) + 타입 가드. `error instanceof Error` 또는 자체 `ApiError` 체크 |
| React 컴포넌트 props         | 구체적인 Props 인터페이스                                                           |
| 폼 (react-hook-form 도입 시) | Zod schema에서 `z.infer<typeof Schema>`                                             |
| 환경변수                     | `string \| undefined` 후 `??` fallback (`process.env.X ?? 'default'`)               |

## 타입 어서션 기준

### 허용

- `as const` — 리터럴 타입 보존 (`const KEYS = { a: 'a' } as const`)
- 외부 라이브러리 API가 반환 타입을 너무 넓게 잡았을 때 (이유 주석 필수)
- React Native event target — DOM과 달리 명확한 타입이 없을 때 (이유 주석)

### 금지

- 타입 오류 회피용 어서션
- `as unknown as TargetType` 이중 어서션 (불가피 시 이유 주석 필수 + 리뷰 대상)
- `as any` (이건 그냥 `any` 사용과 동급으로 취급)

## NestJS DTO 타입 패턴

### 채택 — class-validator + class-transformer

```typescript
// apps/server/src/auth/dto/sign-in.dto.ts
import { IsEmail, MinLength } from 'class-validator';

export class SignInDto {
  @IsEmail()
  email!: string;

  @MinLength(8)
  password!: string;
}
```

- `!:` (definite assignment) 사용 — TypeORM/DTO class에서 표준. 런타임은 ValidationPipe가 보장.
- API 응답 DTO도 class로 (Swagger `@ApiProperty` 박을 수 있음).

### 거부 — interface만 + 수동 validation

- Validation 누락 위험. NestJS 생태계 표준이 아님.

## 모바일 응답 타입

현재 — 백엔드 응답을 모바일에서 받을 때는 `apiRequest<T>(...)`의 제네릭으로 명시:

```typescript
const me = await apiRequest<{ id: string; email: string }>('/auth/me');
```

향후 (Phase 후속 옵션):

- **옵션 A**: `packages/shared-types/` 도입 — 백엔드 DTO를 모바일에서 import (모노레포 장점).
- **옵션 B**: Zod schema를 양쪽에서 공유 — runtime parse + infer type 동시.
- **옵션 C**: openapi/swagger spec → 타입 자동 생성.

→ Phase 2 4.6 (모바일 첫 화면) 진입 시 어느 옵션 선택할지 결정.

## 제네릭 사용

### 좋은 예

```typescript
async function apiRequest<T = unknown>(path: string): Promise<T> { ... }
// 호출 시: apiRequest<TokenPair>('/auth/login')

function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> { ... }
```

### 나쁜 예

```typescript
function process<T>(input: T): T {
  return input;
} // 제네릭 의미 X
function wrap<T>(x: T): any {
  return x;
} // any로 끝나면 무의미
```

## `catch` 패턴

```typescript
try {
  // ...
} catch (error) {
  if (error instanceof ApiError) {
    // 우리 자체 에러 → status, body 등 접근 가능
  } else if (error instanceof Error) {
    // 표준 에러
  } else {
    // 알 수 없음 — 그대로 throw 또는 wrapping
  }
}
```

## 하면 안 되는 것

- `any`로 타입 오류 임시 우회 — 차라리 TODO 주석 박고 `unknown`으로
- `@ts-ignore` / `@ts-expect-error` (불가피 시 이유 주석 + 리뷰 대상)
- DTO 응답 타입을 손으로 `interface` 작성 + 백엔드 DTO와 따로 관리 — Phase 후속에 단일 출처 도입
- `Object` / `{}` / `Function` 사용 — 거의 `any`와 동급. `Record<string, unknown>` 등 구체 타입 사용
