# 코드 스타일 가이드 (공통)

백엔드(NestJS) + 모바일(RN/Expo) 양쪽 적용. **메서드/함수 내부 작성 규칙** 위주.
프레임워크 특화 룰은 `nest-backend.md` / `rn-mobile.md` 참고.

## 1. 명명 규칙

### 변수

- **boolean**: `is{X}` / `has{X}` / `should{X}` / `can{X}` / `was{X}` 시작
  - ✅ `isValid`, `hasPermission`, `shouldRetry`, `canEdit`
  - ❌ `valid`, `permission`, `retry`, `edit`
- **수량/길이**: `count` / `length` / `size` 명시
  - ✅ `userCount`, `photoLength`, `bufferSize`
  - ❌ `users`, `photos` (배열 자체 의미와 혼동)
- **데이터 + 상태**: `loaded{X}` / `selected{X}` / `current{X}` / `previous{X}`
  - ✅ `selectedTrip`, `currentUser`, `previousValue`

### 함수/메서드

- **동사로 시작** — `get`, `create`, `find`, `update`, `delete`, `validate`, `parse`, `format`, `compute`, `build`, `transform`
- **도메인 동사 우선** — 의미 있는 도메인 동사가 있으면 그대로 (`signUp`, `refresh`, `rotateToken`)
- **async 함수에 `Async` suffix X** — Promise 반환 타입으로 명확함 (`signIn(): Promise<TokenPair>`)
- **private helper**: 동사 시작 + camelCase (`hashPassword`, `generateTokenPair`)

### 상수

- **top-level 상수**: 파일 상단 + `UPPER_SNAKE_CASE`
  - ✅ `const BCRYPT_COST = 10`, `const REFRESH_PATH = '/auth/refresh'`
- **함수 내 상수**: camelCase OK (스코프 좁음)
- **magic value 금지** — 의미 있는 상수로 추출
  - ❌ `if (age > 18)` → ✅ `const ADULT_AGE = 18; if (age > ADULT_AGE)`
  - ❌ `setTimeout(fn, 86400000)` → ✅ `const ONE_DAY_MS = 86_400_000`

### Enum / Union

- enum 값: `UPPER_SNAKE_CASE` (NestJS/참조 패턴 일관)
- 리터럴 union: 소문자 케밥 또는 도메인 어휘
  - ✅ `type Status = 'pending' | 'processing' | 'done' | 'failed'`

## 2. Early Return 우선

**nested if 금지**. guard 패턴으로 입력 검증 → early throw/return → happy path는 함수 끝.

### 좋은 예

```typescript
async signIn(dto: SignInRequestDto): Promise<TokenPair> {
  const user = await this.usersService.findByEmail(dto.email);
  if (!user) {
    throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
  }

  const isValid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');
  }

  return this.generateTokenPair(user);
}
```

### 나쁜 예

```typescript
async signIn(dto: SignInRequestDto): Promise<TokenPair> {
  const user = await this.usersService.findByEmail(dto.email);
  if (user) {
    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (isValid) {
      return this.generateTokenPair(user);
    } else {
      throw new UnauthorizedException('...');
    }
  } else {
    throw new UnauthorizedException('...');
  }
}
```

### 추가 규칙

- **`data?.xxx ?? fallback` 패턴 금지** — early return으로 분기 명시
  - ❌ `const name = user?.profile?.name ?? '익명'`
  - ✅ `if (!user?.profile) return '익명'; return user.profile.name`
- **삼항 중첩 금지** — 변수로 분리 또는 함수 추출
- **`else` 블록 최소화** — early return 사용

## 3. async / await 패턴

### 원칙

- **`async/await` 우선**. `.then()` chaining 금지
- **병렬 처리 — `Promise.all`** (모두 성공해야 진행)
- **부분 처리 — `Promise.allSettled`** (일부 실패해도 진행)
- **타임아웃 — `Promise.race`**

### 좋은 예

```typescript
// 병렬 — 두 token 동시 발급
const [accessToken, refreshToken] = await Promise.all([
  this.jwtService.signAsync(payload, { expiresIn: '15m' }),
  this.jwtService.signAsync(payload, { expiresIn: '7d' }),
]);

// 순차 — 의존성 있을 때
const user = await this.usersService.findByEmail(email);
const session = await this.sessionService.create(user.id);
```

### 나쁜 예

```typescript
// .then chain
return this.usersService
  .findByEmail(email)
  .then((user) => this.sessionService.create(user.id))
  .then((session) => ({ session }));
```

## 4. try / catch 패턴

### 원칙

- **try 블록은 최소 범위** — 위험한 호출만 (외부 API, JWT verify, JSON.parse, fetch 등)
- **catch는 `unknown` 받아서 타입 가드** — `instanceof` / `typeof`
- **silent swallow 금지** — catch에서 무시하지 말고 throw 또는 변환
- **변수가 try/catch 밖에서 필요하면 `let` 외부 선언 + try 안 할당**

### 좋은 예

```typescript
let payload: JwtPayload;
try {
  payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
} catch {
  throw new UnauthorizedException('유효하지 않은 token');
}

const user = await this.usersService.findById(payload.sub);
```

### 나쁜 예

```typescript
try {
  const payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
  const user = await this.usersService.findById(payload.sub);
  // ... 비즈니스 로직 다 try 안에 (try 너무 큼)
  return result;
} catch (error) {
  // 무엇이 실패했는지 모름
  console.log(error);
  return null; // ❌ silent swallow
}
```

## 5. 매개변수 / 반환값

### 매개변수

- **3개 이하 권장**. 4개+ 또는 boolean flag 2개+ → DTO/options 객체로
- **destructuring은 함수 시작에서**
  - ✅ `function signIn({ email, password }: SignInRequestDto) { ... }`
- **옵셔널 매개변수는 시그니처 끝에**
  - ✅ `function find(id: string, options?: FindOptions)`
- **boolean flag 매개변수 지양** — 의도 모호
  - ❌ `processUser(user, true, false)` → ✅ `processUser(user, { notify: true, archive: false })`

### 반환값

- **항상 타입 명시** — TS 추론에 의존 X
  - ✅ `async signIn(): Promise<TokenPair>`
- **다중 반환은 객체** (튜플 X — 의미 불명확)
  - ✅ `return { user, session }`
  - ❌ `return [user, session]`
- **에러는 throw 또는 `RestResponse.error()`** — `null` 반환으로 에러 표현 금지
  - 예외: `findByEmail(): User | null` 같은 명시적 "없을 수 있음" 시그니처

## 6. 함수 크기

| 영역                  | 권장 상한 | 초과 시                                             |
| --------------------- | --------- | --------------------------------------------------- |
| service public 메서드 | 40줄      | private helper 추출 또는 service 분리 신호          |
| private helper        | 20줄      | 더 작은 함수로 분리                                 |
| controller 메서드     | 10줄      | 로직 service로 이동                                 |
| 모바일 컴포넌트       | 300줄     | 훅 추출 또는 자식 컴포넌트 분리 (rn-mobile.md 참고) |

**측정 기준**: 빈 줄 제외 순수 코드 줄. 초과는 정렬 정도가 OK, 30% 이상 초과 시 분리.

## 7. 빈 줄로 논리 구분

- **guard / validation 블록 후** 빈 줄
- **데이터 fetch 후** 빈 줄
- **return 직전** 빈 줄 (옵션 — 짧은 함수는 생략 OK)
- **같은 종류 연속**(의존성 주입, 상수 묶음, 짧은 await 연쇄)엔 빈 줄 X

```typescript
async refresh(token: string): Promise<TokenPair> {
  let payload: JwtPayload;
  try {
    payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
  } catch {
    throw new UnauthorizedException('유효하지 않은 token');
  }
                                                          // ← 빈 줄
  const user = await this.usersService.findById(payload.sub);
  if (!user) {
    throw new UnauthorizedException('계정을 찾을 수 없습니다');
  }
                                                          // ← 빈 줄
  return this.generateTokenPair(user);
}
```

## 8. 변수 선언

- **`const` 기본** — mutation 필요할 때만 `let`. `var` 금지
- **변수 사용 위치 가까이 선언** — 함수 시작에서 다 선언 X
- **단일 선언 = 단일 줄** — `let a, b, c` 같은 다중 선언 X
- **destructuring 우선** — 객체에서 여러 property 꺼낼 때

## 9. 주석 — WHY 위주

- **WHAT은 코드가 말함** — 변수명/함수명으로 의도 명확화
- **WHY는 주석으로** — 비즈니스 결정, 보안 사유, 트레이드오프, 학습 컨텍스트
- **JSDoc은 public API에만** — 자동 문서/IDE hover 가치
- **불필요 주석 금지** — `// user 가져오기` 같은 코드 그대로 풀이

### 좋은 예

```typescript
// 이메일 존재 여부 노출 안 하려고 일반화된 메시지
throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다');

// refresh payload는 email 빼고 sub만 — 최소 노출 원칙
this.jwtService.signAsync({ sub: payload.sub }, { secret: refreshSecret });
```

### 나쁜 예

```typescript
// 사용자를 찾는다
const user = await this.usersService.findByEmail(email); // ← 자명

// 비밀번호를 hash한다
const hash = await bcrypt.hash(password, BCRYPT_COST); // ← 자명
```

## 10. import 순서

1. **외부 패키지** (`@nestjs/...`, `react`, `bcrypt`, `expo-*`)
2. **내부 alias** (`@/...`)
3. **상대 경로** (`./...`, `../...`)

그룹 사이 **빈 줄 1개**. 그룹 안은 알파벳 순서 (ESLint import/order plugin 자동).

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import { UsersService } from '@/users/users.service';

import { JwtPayload } from './auth-types';
```

## 11. 타입 가드 패턴

- **`unknown` 받으면 narrow 후 사용** — `typeof`, `instanceof`, `in`
- **자체 가드 함수**: `function isXxx(x: unknown): x is Xxx { ... }`
- **discriminated union narrow**: `if (response.type === 'SUCCESS')` 식

```typescript
function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

try {
  // ...
} catch (error) {
  if (isApiError(error)) {
    // error.status, error.body 접근 가능
  } else if (error instanceof Error) {
    // 표준 에러
  } else {
    throw error;
  }
}
```

## 12. null vs undefined

- **`null`**: 의도적 "값 없음" — DB column NULL, 명시적 reset, 의미 있는 부재
- **`undefined`**: 미입력 / 옵셔널 — 함수 매개변수, optional property
- **한 API 응답에서 둘 섞지 말 것** — 일관성 ↓ + 클라 분기 복잡
  - 참조 패턴: response의 nullable 필드는 `null` 통일

```typescript
interface User {
  id: string;
  email: string;
  profileImageUrl: string | null; // ← DB에 NULL 가능 → null
  displayName?: string; // ← 옵셔널 property → undefined
}
```

## 13. Logging

### 백엔드

- **NestJS `Logger` 사용** — `new Logger(MyClass.name)`
- **`console.*` 사용 금지** (production)
- **로그 레벨**: `error` > `warn` > `log` > `debug` > `verbose`

### 모바일

- **개발 시 `console.*` OK**
- **production은 Sentry 등 별도 도구로** (Phase 후속 도입)

### 공통 — 민감 정보 절대 X

다음 단어 포함 필드는 로그 전 sanitize:

- `password`, `passwordHash`, `token`, `accessToken`, `refreshToken`, `jwt`, `secret`, `authorization`, `cookie`, `apiKey`

```typescript
// 좋은 예
this.logger.error(`로그인 실패: ${email}`); // password는 로그 X

// 나쁜 예
this.logger.log(`로그인 요청: ${JSON.stringify(dto)}`); // password 노출 ❌
```

## 14. 비동기 데이터 mutation

- **배열 직접 변이 금지** — `push`, `splice`, `sort` (in place) 사용 시 spread로 새 배열
  - ❌ `array.push(item)`
  - ✅ `const newArray = [...array, item]`
- **객체 직접 변이 금지** — spread 사용
  - ❌ `obj.foo = bar`
  - ✅ `const newObj = { ...obj, foo: bar }`
- **예외**: TypeORM entity는 mutate 후 `repository.save(entity)` 자연. service 내부만.

## 15. 함수 합성 우선

- **분기/검증 함수는 boolean 또는 에러 메시지 반환** — throw 안 함 (합성 가능)
- **변환 함수는 입력 → 출력 (side effect X)**
- **side effect 함수는 명시적 — `process`, `execute`, `dispatch`, `notify` 등 동사**

```typescript
// 합성 가능
function isValidEmail(email: string): boolean { ... }
function validatePassword(password: string): string | null { ... }  // null = OK, string = error msg

// side effect 명시
async dispatchAlert(error: Error): Promise<void> { ... }
async notifyUser(userId: string, message: string): Promise<void> { ... }
```

## 16. 하면 안 되는 것 (총정리)

- `any` 사용 (`type-safety.md` 참고)
- nested if (3 단계+) — early return으로 평탄화
- `data?.xxx ?? fallback` 패턴 — early return으로 분기
- `.then()` chaining — async/await
- silent catch (`catch { /* 무시 */ }`)
- magic number/string — 의미 있는 상수
- WHAT 풀이 주석 — WHY만
- boolean flag 매개변수 다수
- 함수 시작에 모든 변수 미리 선언
- 변수 mutation (배열/객체 in place)
- 민감 정보 로깅
