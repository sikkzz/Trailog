# NestJS 백엔드 룰 (`apps/server/`)

NestJS 프로덕션 모범 사례 + Trailog 컨텍스트 맞춤. ORM은 TypeORM 1.0 (ADR-0006). PostgreSQL + uuid PK.

## 네이밍 규칙

| 대상                      | 규칙                                             | 예시                                                                                      |
| ------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 모듈 파일                 | `{feature}.module.ts`                            | `auth.module.ts`, `users.module.ts`                                                       |
| 서비스 파일               | `{feature}.service.ts` / `{specific}.service.ts` | `auth.service.ts`, `password.service.ts` (분리 시)                                        |
| 컨트롤러 파일             | `{feature}.controller.ts`                        | `auth.controller.ts`                                                                      |
| 엔티티 파일               | `{name}.entity.ts`                               | `user.entity.ts`, `trip.entity.ts`                                                        |
| **DTO 파일**              | `{action}-{feature}.dto.ts`                      | `sign-in.dto.ts`, `change-password.dto.ts`                                                |
| **DTO 클래스 (Request)**  | `{Action}{Feature}RequestDto`                    | `SignInRequestDto`, `SignUpRequestDto`, `RefreshTokenRequestDto`                          |
| **DTO 클래스 (Response)** | `{Action}{Feature}ResponseDto`                   | `SignInResponseDto`, `RefreshTokenResponseDto`                                            |
| Guard 파일                | `{name}.guard.ts`                                | `jwt-auth.guard.ts`, `optional-jwt-auth.guard.ts`                                         |
| Strategy 파일             | `{name}.strategy.ts`                             | `jwt.strategy.ts`                                                                         |
| Decorator 파일            | `{name}.decorator.ts`                            | `current-user.decorator.ts`                                                               |
| 마이그레이션 파일         | `{timestamp}-{Slug}.ts`                          | `1779978806585-Init.ts` (TypeORM CLI가 생성)                                              |
| 디렉토리                  | kebab-case                                       | `apps/server/src/auth/`                                                                   |
| 클래스명                  | PascalCase                                       | `AuthService`, `SignInRequestDto`                                                         |
| 메서드명                  | camelCase + 동사 + 도메인 명사 (필수)            | `signUp`, `signIn`, `createMoment`, `findMomentsByUserId`, `findUserByEmail`, `getMyInfo` |
| 상수                      | UPPER_SNAKE_CASE                                 | `BCRYPT_COST_FACTOR`, `JWT_EXPIRES_IN`                                                    |

### DTO 명명 규칙 — 핵심

**모든 DTO는 `Request` 또는 `Response` 명시**.

- ✅ `SignInRequestDto`, `SignInResponseDto`
- ❌ `SignInDto` (Request인지 Response인지 모호)
- 사유: 학습 컨텍스트에서 요청/응답 구분 명확성 ↑. Controller 코드 읽을 때 즉시 이해.

**DTO suffix는 `Dto` (Pascal)** — NestJS 공식 컨벤션 (`@nestjs/cli` 생성, 공식 문서 예제).

## 디렉토리 구조

기능(domain) 단위로 폴더. 한 폴더 안에 module + service + controller + 하위 폴더 (dtos/entities/guards/strategies/decorators).

```
apps/server/src/
├── app.module.ts
├── main.ts
├── auth/                       # 인증 도메인
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── dtos/                   # 복수형 (3+ 파일이면 폴더로)
│   │   ├── sign-in.dto.ts      # SignInRequestDto + SignInResponseDto 한 파일
│   │   ├── sign-up.dto.ts
│   │   └── refresh-token.dto.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── optional-jwt-auth.guard.ts  # Phase 후속 (선택적 인증)
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── decorators/
│       └── current-user.decorator.ts
├── users/
│   ├── users.module.ts
│   ├── users.service.ts
│   └── user.entity.ts
├── common/                     # 공통 유틸/클래스
│   ├── rest-response.ts        # RestResponse class + RestResponseCode/Method enum
│   ├── filters/
│   │   └── all-exceptions.filter.ts  # Phase 후속 (운영 모니터링 시점)
│   └── interceptors/
│       └── response.interceptor.ts   # Phase 후속 (RestResponse 자동 wrap)
└── database/
    ├── data-source.ts
    ├── database.module.ts
    └── migrations/
```

규모 작을 땐 `dtos/`, `guards/` 폴더 안 만들고 평탄해도 OK (파일 1~2개일 때). 3개 넘으면 폴더로.

**디렉토리 복수형 컨벤션**: `dtos/`, `guards/`, `strategies/`, `decorators/`, `filters/`, `interceptors/`, `migrations/` — 폴더는 복수, 파일은 단수 그대로.

## 모듈 책임 분리 (단일 책임)

각 module은 **한 도메인의 책임만** 담당.

| Layer      | 책임                                                          | 예시                                                            |
| ---------- | ------------------------------------------------------------- | --------------------------------------------------------------- |
| Controller | HTTP 요청 받기, DTO validation, 응답 status code 결정         | `@Post('login')`, `@UseGuards(JwtAuthGuard)`                    |
| Service    | 비즈니스 로직, 다른 service/repository 조율                   | `authService.signIn(email, password)`                           |
| Repository | DB 쿼리 (TypeORM은 service에서 직접 `@InjectRepository`도 OK) | `userRepository.findOne({ where: { email } })`                  |
| Entity     | DB 스키마 + 도메인 규칙 (간단한 메서드 OK)                    | `User { id, email, passwordHash }`                              |
| DTO        | API 입력/출력 타입 + class-validator 규칙                     | `SignInRequestDto { @IsEmail() email, @MinLength(8) password }` |
| Guard      | 요청 통과 여부 (인증/권한)                                    | `JwtAuthGuard` — passport-jwt strategy 호출                     |
| Strategy   | passport 전략 — token 검증 + payload → user 변환              | `JwtStrategy.validate(payload) → User`                          |
| Decorator  | 컨트롤러에서 자주 쓰는 메타데이터/추출                        | `@CurrentUser() user: User`                                     |

### 절대 하면 안 되는 것

- **Controller에 비즈니스 로직** — 컨트롤러는 DTO 받아 service 호출 + 응답 반환만
- **Service에 HTTP 응답 객체 (`res.status(...).send()`)** — Service는 도메인 객체 또는 `RestResponse`만 반환, HTTP 응답은 Controller + ResponseInterceptor 책임
- **Entity에 외부 의존성** (HTTP, 외부 API 호출) — Entity는 순수 데이터 + 도메인 규칙
- **순환 import** — module A가 B를 import + B가 A를 import. 공통 부분 분리 또는 event 패턴

## Service 분리 신호 (하이브리드 전략)

**기본은 도메인당 하나의 service** (`AuthService` 단일). 아래 신호 중 하나라도 만족하면 분리.

| 분리 후보 service          | 분리 신호                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `PasswordService`          | bcrypt cost factor 변경, pepper 도입, password hash 알고리즘 추상화 (argon2 등 후속 검토), 비밀번호 정책 강화 |
| `TokenService`             | JWT 외 다른 token 등장 — password reset token, magic link token, email verification token 등 2종+ 필요 시     |
| `SessionService`           | Stateless JWT → Stateful 전환 시 (Redis blacklist, refresh token 회전, device 별 session 관리)                |
| `OAuthService`             | OAuth provider 도입 시 (카카오/구글/Apple 등). 1 provider까지는 inline, 2+ 되면 분리                          |
| `EmailVerificationService` | 이메일 인증 흐름 도입 시 (가입 시점 또는 이메일 변경 시)                                                      |
| `TwoFactorService`         | 2FA 도입 시 (TOTP, SMS, Email 인증기 1+ 등장 시)                                                              |
| `AuthLogService`           | 인증 감사 로그 (로그인 이력, 토큰 발급/갱신/회수 이력) 별도 테이블 + 조회 endpoint 필요 시                    |

**분리 판단 기준**:

- AuthService 길이 **300줄** 초과 시 분리 검토
- public 메서드 **10개** 초과 시 분리 검토
- 단, **분리 자체가 목적이 되지 않게** — 응집도 (cohesion)가 같으면 한 service 유지

**참고**: Phase 후속 분리 시점 시그널은 메모리 `auth-deep-dive-revisit` 참조 (메모리는 git X, 외부 비교 패턴 박제).

## 컨트롤러 코드 순서

```typescript
@Controller('auth')
@ApiTags('Auth') // 1. 데코레이터
export class AuthController {
  constructor(
    // 2. 의존성 주입
    private readonly authService: AuthService,
  ) {}

  @Post('sign-up') // 3. 엔드포인트 (도메인 흐름 순: signUp → signIn → refresh → logout)
  @ApiOperation({ summary: '회원가입' })
  @ApiOkResponse({ type: SignUpResponseDto })
  async signUp(@Body() dto: SignUpRequestDto): Promise<RestResponse<SignUpResponseDto>> {
    return this.authService.signUp(dto);
  }
}
```

### 컨트롤러 메서드 내부 순서

1. DTO/파라미터 가공 (필요 시 — 최소화)
2. Service 호출
3. 반환 (Service가 이미 `RestResponse` 반환했다면 그대로)

→ **로직 없음**. 로직이 들어가면 service로 옮김.

### 메서드 명명 — 동사 + 도메인 명사 (필수)

**모든 controller / service 메서드는 도메인을 메서드명에 포함**. 일반 CRUD 메서드도
`create` / `findAll` 같은 generic은 금지 — 도메인 명사를 붙여 `createMoment` /
`findMomentsByUserId` 형태로.

✅ 좋은 예:

- 인증 도메인 (동사 자체에 도메인 명확): `signUp`, `signIn`, `signOut`, `refreshTokens`,
  `changePassword`, `resetPassword`, `withdrawalUser`
- CRUD 도메인: `createMoment`, `findMomentsByUserId`, `updateMoment`, `deleteMoment`
- 사용자 조회: `findUserByEmail`, `findUserById`, `createUser`, `getMyInfo`

❌ 나쁜 예:

- `create`, `update`, `findAll`, `findOne`, `remove`, `get`, `findByEmail`, `findById`
- (도메인 모호 — 어느 service의 메서드인지 스택 트레이스/로그에서 추적 어려움)

**사유**:

- 스택 트레이스 / 로그에서 메서드명만으로 어느 도메인인지 즉시 추적 (디버깅 가속)
- IDE "Find usages" 시 다른 도메인의 동명 메서드와 분리 (`grep "createMoment"` 깔끔)
- Service 인스턴스 여러 개 주입 시 호출 의도 명확 (`momentsService.createMoment(...)`
  vs `momentsService.create(...)` — 후자는 import만 보지 않으면 모호)

**Controller vs Service**:

- Service: 매개변수 명시 — `findMomentsByUserId(userId)`, `findUserByEmail(email)`
- Controller: 현 사용자 컨텍스트 — `findMyMoments()`, `getMyInfo()` ("내 것" 의도 명확)

**예외**:

- 인증 동사 (`signUp` / `signIn` / `signOut` / `refreshTokens`) — 동사 자체가
  도메인 명확. 명사 생략 OK (`signUpUser` 어색).

## 서비스 코드 순서

```typescript
@Injectable()
export class AuthService {
  constructor(                              // 1. 의존성 주입
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // 2. public 메서드 (도메인 흐름 순서: signUp → signIn → refresh → logout)
  async signUp(dto: SignUpRequestDto): Promise<RestResponse<SignUpResponseDto>> { ... }
  async signIn(dto: SignInRequestDto): Promise<RestResponse<SignInResponseDto>> { ... }
  async refreshTokens(dto: RefreshTokenRequestDto): Promise<RestResponse<RefreshTokenResponseDto>> { ... }

  // 3. private helper (밑에 모아두기)
  private async hashPassword(password: string): Promise<string> { ... }
  private generateTokenPair(user: User): TokenPair { ... }
}
```

## DTO 패턴

### Request DTO + Response DTO 한 파일

```typescript
// apps/server/src/auth/dtos/sign-in.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInRequestDto {
  @ApiProperty({ example: 'user@trailog.app' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class SignInResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;
}
```

### 규칙

- **`!:` (definite assignment)** — TypeORM/DTO class에서 표준. 런타임은 ValidationPipe가 보장
- **Request DTO + Response DTO는 같은 파일** — 같은 endpoint의 input/output을 한 파일에
- **`@ApiProperty` 모든 property에** — Swagger UI에서 example 노출 + 클라이언트 자동 생성 시 도움
- **공통 응답 (성공 메시지만)은 `RestResponse` 단독 사용** — 별도 ResponseDto 필요 X

### ValidationPipe 전역 등록

`apps/server/src/main.ts`에 한 번:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // DTO에 없는 property 제거
    forbidNonWhitelisted: true, // 추가 property 있으면 400
    transform: true, // class-transformer로 인스턴스 변환
  }),
);
```

## RestResponse 표준 응답 (Phase 2 4.1 정정 commit에서 도입)

모든 API 응답은 `RestResponse<T>` 형태로 표준화. 모바일 client는 `code` + `method` enum으로 다음 액션 결정 가능 (contract 강화).

### 응답 형식

```typescript
{
  type: 'SUCCESS' | 'ERROR',
  code: string,        // RestResponseCode enum 값
  data: T | null,
  message: string | null,
  status: number,      // HTTP status
  method: string       // RestResponseMethod enum 값 (모바일이 자동 액션 결정용)
}
```

### Code enum (Trailog 단순화 버전)

```typescript
export enum RestResponseCode {
  NORMAL = '001', // 정상
  INVALID_PARAMETER = '002', // 잘못된 파라미터
  TOKEN_EXPIRED = '003', // 토큰 만료
  VALIDATE_ERROR = '004', // 유효성 검사 실패
  DUPLICATE_ERROR = '005', // 중복 (이메일 등)
  NOT_FOUND = '006', // 리소스 없음
  UNAUTHORIZED = '007', // 인증 실패
  FORBIDDEN = '008', // 권한 없음
  INTERNAL_SERVER_ERROR = '009', // 서버 내부 에러
}
```

**Phase 후속 확장 예정 코드** (도입 시점에 추가):

- `TOKEN_NOT_FOUND` (refresh token 없음)
- `BLOCKED` (사용자 차단 — soft delete / suspension 기능 도입 시)
- `RATE_LIMITED` (rate limit 도입 시)
- `MAINTENANCE` (점검 모드 도입 시)

### Method enum (모바일 자동 액션)

```typescript
export enum RestResponseMethod {
  NONE = 'NONE', // 클라 자체 처리
  LOG_OUT = 'LOG_OUT', // 강제 로그아웃 (token 모두 무효)
  LOGIN_REQUIRED = 'LOGIN_REQUIRED', // 로그인 화면 redirect
  BLOCKED = 'BLOCKED', // 접근 차단 화면
}
```

모바일 `apiRequest` wrapper가 응답의 `method` 값을 보고 자동 처리. 예: `LOG_OUT` 받으면 secure storage 비우고 로그인 화면 이동.

### 사용 패턴 — Service에서 RestResponse 반환

```typescript
async signIn(dto: SignInRequestDto): Promise<RestResponse<SignInResponseDto>> {
  const user = await this.usersService.findByEmail(dto.email);
  if (!user) {
    return new RestResponse<SignInResponseDto>().error('이메일 또는 비밀번호가 일치하지 않습니다', {
      code: RestResponseCode.UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
      method: RestResponseMethod.LOGIN_REQUIRED,
    });
  }

  const isValid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!isValid) {
    return new RestResponse<SignInResponseDto>().error('이메일 또는 비밀번호가 일치하지 않습니다', {
      code: RestResponseCode.UNAUTHORIZED,
      status: HttpStatus.UNAUTHORIZED,
    });
  }

  const tokens = await this.generateTokenPair(user);
  return new RestResponse<SignInResponseDto>().success(tokens);
}
```

### Builder 패턴 — fluent interface

```typescript
new RestResponse<T>().success(data, { message: '저장되었습니다' });
new RestResponse<T>().error('이메일 중복', { code: RestResponseCode.DUPLICATE_ERROR, status: 409 });
new RestResponse<T>().error('refresh token 만료', {
  code: RestResponseCode.TOKEN_EXPIRED,
  method: RestResponseMethod.LOG_OUT,
});
```

### Controller에서 RestResponse 활용

```typescript
@Post('sign-in')
async signIn(@Body() dto: SignInRequestDto): Promise<RestResponse<SignInResponseDto>> {
  return this.authService.signIn(dto);  // service가 이미 RestResponse 반환
}
```

응답 자동 status code 처리는 ResponseInterceptor가 담당 (Phase 후속 도입 — 지금은 controller가 직접 반환).

### Error 처리 — throw vs RestResponse 반환

- **클라이언트 유도용 에러** (재로그인, 차단 안내 등) → `RestResponse.error()` 반환 + `method` enum
- **개발자/시스템 에러** (validation 자동 던짐, 예측 못 한 에러) → 그대로 throw (전역 `ExceptionFilter`가 잡아서 `RestResponse` 변환 — Phase 후속)

Phase 2 4.1 정정 commit에선 RestResponse 직접 반환 패턴만 도입. ExceptionFilter는 Phase 4+ 운영 모니터링 시점.

## 엔티티 패턴 (TypeORM)

```typescript
// apps/server/src/users/user.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// @Entity 자체에 도메인 의미 (한국어 comment)
@Entity({ name: 'users', comment: '사용자 — 인증 + 도메인 자산 소유자' })
export class User {
  @PrimaryGeneratedColumn('uuid') // uuid 권장 (분산 가능 + 노출 안전)
  id!: string;

  @Column({
    type: 'varchar',
    length: 255,
    comment: '로그인 식별자 이메일 (unique). 형식 검증은 DTO 레이어',
  })
  email!: string;

  @Column({
    name: 'password_hash', // DB 컬럼은 snake_case
    type: 'varchar',
    length: 255,
    select: false,
    comment: 'bcrypt hash 저장 (raw 비밀번호 금지). select:false로 기본 조회 제외',
  })
  passwordHash!: string; // TS 필드는 camelCase

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 규칙

- **Table 이름은 snake_case 복수** (`users`, `trips`, `photos`)
- **컬럼 이름은 snake_case** (`@Column({ name: 'password_hash' })`)
- **TS 필드는 camelCase**
- **PK는 uuid** (분산 / API 노출 안전). 명백한 이유 있을 때만 `bigint`
- **timestamps 필수**: `created_at`, `updated_at`. soft delete 필요하면 `deleted_at` (`@DeleteDateColumn`)
- **인덱스 명시**: `@Index()` — unique constraint, 자주 조회되는 FK, 정렬 사용 컬럼
- **컬럼 nullable 명시** — `@Column({ nullable: true })`. 기본값은 NOT NULL
- **DB COMMENT 필수** — `@Entity({ comment })` + `@Column({ ..., comment })` 한국어 명시 (자세히 ↓)

### DB COMMENT 필수 (인수인계 패턴)

모든 entity/column에 한국어 `comment` 옵션 강제. TypeORM이 마이그레이션 SQL에
`COMMENT ON TABLE/COLUMN` 자동 박음 → psql `\d+` / DBeaver / TablePlus 등 GUI에서
컬럼 의미가 직접 노출됨 (TS 주석은 DB inspect 시 안 보임).

**적용 대상:**

- `@Entity({ name: 'xxx', comment: '도메인 의미' })` — table-level 한국어 설명
- 모든 `@Column({ ..., comment: '...' })` — 컬럼 의미 + 사용 상태 명시
  ('현재는 미사용', 'OFFICIAL만 사용 중', '회원가입 시점부터 채워짐' 등)
- enum / 상태 컬럼 → comment에 **"사용 중인 값"** 명시
  (예: `'pending/done/failed — confirm 직후 pending'`)

**예외 (comment 생략 OK):**

- `@PrimaryGeneratedColumn` — TypeORM API에 `comment` 옵션 없음 (자동 id 명확)
- `@CreateDateColumn` / `@UpdateDateColumn` / `@DeleteDateColumn` — 감사용 자명
- 관계 데코레이터 (`@ManyToOne` / `@OneToMany` / `@OneToOne` / `@JoinColumn`)
  → `comment` 옵션 없음 → 위에 `// 관계 의미` 한 줄 TS 주석으로 대체

**사유:**

- TS 주석은 DB 직접 inspect 시 안 보임 (DBA, 데이터 분석가, 인수인계자는 코드 안 봄)
- 마이그레이션 SQL이 self-document — 외부 협업자 ramp-up 비용 ↓
- 미래 본인 망각 대비 (학습 프로젝트 특히 중요)
- 참조 백엔드 인수인계 패턴 일관 (메모리 `feedback-entity-comment-pattern` 참조)

**검증:**

- `migration:generate` 후 SQL에 `COMMENT ON TABLE/COLUMN` 라인이 박혀있는지 확인
- 빠지면 entity `comment` 옵션 누락 → entity 수정 후 마이그레이션 재생성
- 적용 검수: `docker exec ... psql -U trailog -d trailog -c "\d+ table_name"`의
  Description 컬럼에 한국어가 박혔는지

## 마이그레이션

- **CLI로 생성**: `pnpm migration:generate` (entity 변경 자동 감지)
- **COMMENT 변경도 자동 generate 잡힘** — entity `comment` 옵션 추가/수정 후
  `migration:generate`로 `COMMENT ON TABLE/COLUMN` SQL 자동 생성
- **수동 작성**: `pnpm migration:create` (raw SQL이나 PostGIS 확장 등 entity로 표현 불가한 것)
- **production에서 `synchronize: true` 절대 금지** — 마이그레이션으로만 스키마 변경
- **마이그레이션은 reversible** — `up`은 반드시 `down`도 함께 작성
- **commit 전 로컬에서 up + down + up 한 번 돌려보기**

## 커스텀 데코레이터 패턴

NestJS 표준 + 도메인 자주 쓰는 추출:

- **`@CurrentUser()`** — `request.user` 추출 (JwtAuthGuard 통과 후). 이미 4.1 적용.
- **`@RequestInfo()`** — IP, UserAgent 등 추출 (Phase 후속 — 감사 로그/보안 도입 시)
- **`@PaginationParams()` / `@OrderParams()`** — query string 파싱 (Phase 2 4.3+ 리스트 endpoint 도입 시)

분리 신호: 같은 추출 로직 **2개 이상 컨트롤러에서 반복** 시 decorator로 추출.

## 환경변수

- **`@nestjs/config` 사용** — `ConfigService.get<string>('JWT_SECRET')` 패턴
- **환경변수 schema validation** (Joi 또는 zod) — Phase 후속 도입 가치. 누락된 환경변수 부팅 시 즉시 실패
- **`process.env.X` 직접 참조 금지** — main.ts 등 부팅 직전 제외. 항상 ConfigService 거치기
- **secret은 절대 entity/DTO/응답에 포함 X** — `passwordHash`도 응답 시 제거 (`@Exclude()` 또는 service에서 별도 매핑)

## Swagger 문서

- **모든 컨트롤러 메서드에 `@ApiOperation` + `@ApiOkResponse`** — 인터랙티브 문서 + 모바일 client 검증 시 자연 가이드
- **DTO property에 `@ApiProperty`** — example 값까지 박으면 Swagger UI에서 바로 시도 가능
- **JWT 보호 엔드포인트엔 `@ApiBearerAuth()`** — Swagger UI에서 token 박는 UI 자동 제공
- **응답 타입은 `@ApiOkResponse({ type: SignInResponseDto })`** — generic `RestResponse<T>`는 Phase 후속 자동 wrapping 시 정리

## 가드 패턴

- **`JwtAuthGuard`** — 인증 필수. 401이면 자동 throw.
- **`OptionalJwtAuthGuard`** — 인증 선택적 (로그인 안 한 사용자도 접근 가능. token 있으면 user 추출). Phase 후속 — public + 로그인 사용자 다른 응답 줘야 할 때 도입.

분리 신호: 권한 모델 도입 시점에 `RoleGuard`, `OwnerGuard` 등 추가.

## 코드 수정 시 같이 손볼 것

수정한 파일 안에서 발견하면 같은 commit에 정리:

- `any` 사용 → `unknown` + 타입 가드 또는 구체 타입
- `process.env.X` 직접 참조 → `ConfigService` 사용
- `console.log` (production용) → NestJS `Logger` 사용
- HTTP 응답 status code 누락 → `@HttpCode()` 또는 `HttpStatus.X` 명시
- DTO suffix 정정 (`SignInDto` → `SignInRequestDto` 등)

**별도 commit으로 분리**:

- Service 분리 (한 service가 너무 커짐 — 분리 신호 만족 시)
- Module 재구성 (도메인 경계 변경)
- 테스트 backfill

## 하면 안 되는 것

- **Controller에서 entity/repository 직접 접근** — 항상 service 거치기
- **Service에서 HTTP 객체 (`@Req`, `@Res`) 직접 사용** — 컨트롤러가 가공 후 service에 도메인 객체 전달
- **`@Body()` 받을 때 DTO class 안 쓰고 `any` / `Record<string, unknown>` 사용** — ValidationPipe 무용지물
- **DTO 이름에 `Request`/`Response` 미명시** (`SignInDto`) — 모호. 항상 `SignInRequestDto` / `SignInResponseDto`
- **TypeORM `synchronize: true` in production** — 마이그레이션으로만 스키마 변경
- **순환 의존성** — `forwardRef`로 우회하지 말고 공통 부분 분리
- **에러 응답에 stack trace 노출** — production 모드에선 마스킹

## 외부 코드와의 비교 모드 (메모리)

다른 NestJS 코드베이스와의 비교 모드는 **메모리에서 활성화** — 메모리 룰 `관련 메모리` 참고.
매 코드 작성 시 외부 패턴 + NestJS 모범 사례와 채택/거부 표 + 사유 박제.
이 룰 파일에는 채택된 결과만 박힘 (외부 코드 자체 노출 X).
