# TypeScript strict 모드 + DTO `!:`

> **작성일**: 2026-05-31
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 코드 품질 / 타입 안전성 (PROJECT_ROOT 외 일반 TypeScript)
> **관련 문서**: [type-safety 룰](../../.claude/type-safety.md), [nest-backend 룰](../../.claude/nest-backend.md)

---

## 한 줄 요약

`strict: true`는 **런타임 crash를 컴파일 시점에 차단하는 7+ 옵션 통합 플래그**. NestJS DTO/Entity의 `email!: string` (`!:`, definite assignment assertion)은 그 중 `strictPropertyInitialization`이 강제하는 패턴 — "ValidationPipe/TypeORM이 런타임에 박는다"는 컴파일러 어서션.

## 우리 프로젝트에서 어디에 쓰이는가

- **Trailog 백엔드 (`apps/server/`)**: `strict: true` (NestJS CLI 기본값) — 모든 DTO/Entity에 `!:` 적용
- **Trailog 모바일 (`apps/mobile/`)**: strict 적용 — RN 컴포넌트 props는 `!:` 거의 안 씀 (React 컴포넌트는 props가 함수 인자라 초기화 룰 무관)
- **참조 백엔드** (다른 NestJS 프로젝트, 비교 컨텍스트): `strict` 미통합 + `strictNullChecks`만 부분 활성 → DTO에 `!:` 없음

## strict 모드의 본질

### `strict: true`가 켜는 7+ 옵션

| 옵션                                   | 영향                              | 잡는 버그                                                |
| -------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| `strictNullChecks`                     | null/undefined를 일반 타입과 분리 | `user.name` (user가 undefined면 런타임 crash)            |
| `noImplicitAny`                        | 추론 안 되면 any 금지             | 매개변수 타입 누락 → any 누수 → 어떤 .prop도 통과        |
| `strictFunctionTypes`                  | 함수 인자 contravariance 엄격     | 부모 타입 받는 callback에 자식 타입 callback 전달 (위험) |
| `strictBindCallApply`                  | bind/call/apply 인자 타입 검증    | `add.bind(null, 'wrong')` (string을 number로 전달)       |
| `strictPropertyInitialization`         | 클래스 property 초기화 강제       | `email: string;` 안 박힘 → 런타임 undefined              |
| `noImplicitThis`                       | this 타입 명확                    | function 안 `this`가 any                                 |
| `alwaysStrict`                         | 'use strict' 강제                 | ES strict mode 안 켜진 채 with/octal 등 위험 패턴        |
| `useUnknownInCatchVariables` (TS 4.4+) | catch error를 unknown 강제        | `catch (error) { error.foo }` (any로 추론, 런타임 crash) |

### 가장 큰 가치 — `strictNullChecks`

```typescript
// ❌ Off
function getUserName(id: string) {
  const user = users.find((u) => u.id === id); // 타입: User | undefined
  return user.name; // 컴파일 OK → 런타임 TypeError 가능
}

// ✅ On
function getUserName(id: string) {
  const user = users.find((u) => u.id === id);
  return user.name; // ❌ "Object is possibly 'undefined'"
  // narrow 강제:
  if (!user) return '익명';
  return user.name; // OK
}
```

→ JavaScript 런타임 crash의 90%+가 `undefined.foo` 패턴. strictNullChecks 하나로 차단.

### Trailog 실제 코드 — `strictPropertyInitialization` + `!:`

```typescript
// apps/server/src/auth/dtos/sign-in.dto.ts
export class SignInRequestDto {
  @IsEmail()
  email!: string; // ← !: definite assignment

  @MinLength(8)
  password!: string;
}
```

`!:` 없이 `email: string;` 박으면 컴파일 에러:

```
Property 'email' has no initializer and is not definitely assigned in the constructor.
```

**왜 `!:`가 안전한가** — NestJS의 신뢰할 수 있는 런타임 layer:

1. 모바일 → 백엔드: JSON body 전송
2. NestJS `ValidationPipe` (`main.ts`에서 전역) 자동 호출
3. `class-transformer`가 plain object → `SignInRequestDto` 인스턴스 변환
4. `class-validator`가 `@IsEmail()` `@MinLength(8)` 검증
5. 통과 시 controller에 도착했을 때 **email/password 반드시 박혀있음**

→ `!:`는 "ValidationPipe가 보장하니 컴파일러는 신경 X" 어서션.

TypeORM Entity도 동일 — `repo.create({...})` + `repo.findOne()` 결과는 컬럼 박힌 상태 보장.

## `!:` vs `?:` vs 기본값 — 4가지 옵션

`strictPropertyInitialization` 어기는 코드 해결법:

| 방법                         | 코드                                | 의미                         | 사용처                      |
| ---------------------------- | ----------------------------------- | ---------------------------- | --------------------------- |
| **`?:` optional**            | `email?: string`                    | undefined 가능 — required X  | optional 필드               |
| **기본값**                   | `email: string = ''`                | 빈 fallback — 의미 깨질 위험 | enum default 등 명확한 경우 |
| **constructor 초기화**       | `constructor(public email: string)` | 일반 class                   | DTO/entity엔 부적합         |
| **`!:` definite assignment** | `email!: string`                    | "런타임 보장" 어서션         | DTO/entity 표준 ⭐          |

## 비교 — 다른 NestJS 프로젝트 (점진 enabling 패턴)

실측: 다른 NestJS 프로젝트(대규모 codebase)의 tsconfig는 `strict` 통합 X, **개별 옵션 점진 활성** 패턴:

```json
{
  "compilerOptions": {
    "strictNullChecks": true, // ✅ 가장 큰 가치 — 먼저 켬
    "noImplicitAny": false, // ⚠️ 점진 진행 중 또는 보류
    "strictBindCallApply": false
    // strictPropertyInitialization 자동 false (strict 안 켜져서)
  }
}
```

DTO 패턴 결과:

```typescript
export class UserDTO {
  @IsEmail()
  email: string; // ← `!` 없음 (strictPropertyInitialization 비활성)
}
```

### 왜 점진 enabling인가

대규모 codebase에서 `strict: true` 한 번에 켜면:

- 수백~수천 줄 type 에러 동시 발생
- 마이그레이션 PR 거대화 — 리뷰 불가능
- 머지 충돌 폭증
- 새 기능 작업과 충돌

**합리적 패턴**: 옵션 단위 + 영향 큰 것부터 점진 켜기.

권장 순서 (영향 큰 것 → 작은 것):

1. `strictNullChecks` — 가장 큰 안전 가치
2. `noImplicitAny` — 코드 자기문서화 ↑
3. `strictPropertyInitialization` — class property 안전
4. 나머지 (`strictFunctionTypes`, `strictBindCallApply` 등)

## Trailog는 왜 `strict: true`인가

- **NestJS CLI 기본값** (`nest new`로 만들면 자동)
- **신규 프로젝트** — 마이그레이션 부담 0
- **1인 사이드** — 코드량 작아 strict 켜도 부담 X
- **학습 가치** — TypeScript 완전 활용
- **안전성** — 사이드라도 런타임 crash는 피하는 게 좋음

## Pro / Con 트레이드오프 정리

|                           | 켜기 (`strict: true`)            | 끄기                 |
| ------------------------- | -------------------------------- | -------------------- |
| 런타임 crash 차단         | ✅ null/undefined 90%+           | ❌ 런타임 발견       |
| 리팩토링 안전성           | ✅ 영향 받는 곳 모두 컴파일 에러 | ❌ 깜빡 가능         |
| IDE 자동완성/네비게이션   | ✅ 정확 (타입 narrow 반영)       | ⚠️ any 누수로 부정확 |
| 자기문서화                | ✅ 타입이 의도 명시              | ⚠️ 추론에 의존       |
| 코드량                    | ⬆️ `!:`, `?:`, narrow, 명시 타입 | ⬇️ 간결              |
| 기존 코드 마이그레이션    | ⬆️ 큼                            | —                    |
| 외부 라이브러리 타입 부족 | ⚠️ 우회 코드                     | —                    |
| 학습 곡선                 | ⬆️ TypeScript 깊이 필요          | ⬇️                   |

## 흔한 함정 / 주의할 점

### 1. `!:` 남용 — 신뢰 layer 없는 곳

`!:`는 **ValidationPipe / TypeORM 같은 신뢰 layer가 있을 때만 안전**. 일반 클래스/객체에 남용하면 런타임 undefined:

```typescript
class DangerousService {
  data!: string; // ⚠️ 누가 박는지 불명확
}

const svc = new DangerousService();
svc.data.toLowerCase(); // ❌ Cannot read properties of undefined
```

해결: 진짜 nullable이면 `?:` + narrow. 또는 constructor 초기화.

### 2. `as` 어서션으로 strict 우회

```typescript
// ❌ 안티 패턴 — 어서션으로 strict 회피
const user = users.find((u) => u.id === id) as User;
return user.name; // 런타임 user가 undefined면 crash
```

해결: narrow + early return.

### 3. `// @ts-ignore` 남용

```typescript
// @ts-ignore
const x = undefined.foo; // 컴파일 통과, 런타임 crash
```

해결: `@ts-expect-error` + 이유 주석. 또는 진짜 원인 해결.

### 4. `useUnknownInCatchVariables` (TS 4.4+) 적응

```typescript
// 옛 패턴 (TS 4.4 이전 / 옵션 off)
try { ... } catch (error) {
  console.log(error.message);  // error: any
}

// strict 모드 (TS 4.4+)
catch (error) {
  // error: unknown
  if (error instanceof Error) console.log(error.message);
  else if (typeof error === 'string') console.log(error);
}
```

### 5. 라이브러리 타입 부족 — `as unknown as` 이중 어서션 유혹

```typescript
// ⚠️ 외부 라이브러리 타입이 너무 좁을 때
const x = libFn() as unknown as MyType; // 위험
```

해결: 라이브러리 declaration merging (`declare module 'lib' { ... }`) 또는 issue 제출.

### 6. NestJS DTO `class-validator` 데코레이터 + interface 불일치

```typescript
// ❌ interface — class-validator 못 박음
interface SignInDto {
  email: string;
}

// ✅ class — class-validator 데코레이터 박힘
class SignInRequestDto {
  @IsEmail()
  email!: string;
}
```

NestJS는 class + class-validator + `!:` 조합이 표준.

## 더 파볼 거리

- **strict 점진 마이그레이션 실전** — `strict: true` 단번에 켜고 수백 에러 정복하는 PR. 포트폴리오/포트폴리오 가치 ★★★ (실무에서 한 번 시도 가치)
- **TypeScript 4.4+의 `useUnknownInCatchVariables`** — error handling 패턴 정복
- **discriminated union + exhaustive check** — `never` 활용한 switch 완전성 강제
- **brand types / nominal typing** — `type UserId = string & { __brand: 'UserId' }` — 동일 string이지만 다른 의미 구분
- **`satisfies` 연산자 (TS 4.9+)** — `as`보다 안전한 타입 보장
- **ESLint `@typescript-eslint/strict-boolean-expressions`** — strict 모드와 별개 추가 안전
- **`zod`로 런타임 검증 + 컴파일 타입 동시** — Phase 2 4.6 React Query 도입 시 검토

## 참고 링크

- [TypeScript strict 옵션 공식 문서](https://www.typescriptlang.org/tsconfig#strict)
- [`strictPropertyInitialization` 공식 문서](https://www.typescriptlang.org/tsconfig#strictPropertyInitialization)
- [Definite Assignment Assertions 공식 문서](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-7.html#definite-assignment-assertions)
- [NestJS Validation 공식 문서](https://docs.nestjs.com/techniques/validation)
- [점진 strict 마이그레이션 가이드 — Effective TypeScript](https://effectivetypescript.com/)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

### 2026-05-31 초안 — strict 7+ 옵션 + DTO `!:` 패턴

- Phase 2 4.3 D4 진입 시점에 본인 질문으로 작성
- 참조 백엔드(점진 enabling) vs Trailog(`strict: true`) 비교 박제
- Phase 후속 실무 strict 마이그레이션 PR 시도 시 추가 학습 누적 예정
