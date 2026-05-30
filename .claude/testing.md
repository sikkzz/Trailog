# 테스트 전략 (공통)

백엔드 + 모바일 모두 Jest 기반. 환경/도구는 분리하되 작성 원칙은 공통.

## 환경

| 영역   | 도구                                               | 실행 명령                                           |
| ------ | -------------------------------------------------- | --------------------------------------------------- |
| 백엔드 | Jest + `@nestjs/testing` + ts-jest                 | `pnpm --filter @trailog/server test`                |
| 모바일 | Jest + `@testing-library/react-native` + jest-expo | `pnpm --filter @trailog/mobile test` (Phase 2 4.6+) |
| 전체   | Turborepo                                          | `pnpm test` (root)                                  |

**셋업 시점**:

- 백엔드 Jest: Phase 2 4.2 진입 직전 (4.1 인증 backfill 포함)
- 모바일 RN Testing Library: Phase 2 4.6 모바일 첫 화면 진입 시 (native module mocking 같이 학습)
- E2E (supertest 또는 Detox): 도입 보류. Phase 2 4.3+ presigned URL 흐름 같은 복합 시나리오 생기면 검토.

## AC 기반 테스트

스펙 AC 항목 = 테스트 케이스 제목. 1:1 매핑.

- `describe` 이름은 스펙 기능명과 일치 (예: `describe('AuthService.signIn')`)
- 테스트 설명(`it`)은 **한국어** (AC를 한국어로 쓰므로 그대로 박기)
- 모호한 표현 금지 — "잘 동작한다" 대신 "이메일이 이미 있으면 ConflictException을 던진다"

### 예시

```typescript
// AC: "이메일 + 비밀번호로 가입하면 TokenPair를 반환한다"
it('이메일 + 비밀번호로 가입하면 TokenPair를 반환한다', async () => { ... });

// AC: "이메일이 이미 존재하면 ConflictException을 던진다"
it('이메일이 이미 존재하면 ConflictException을 던진다', async () => { ... });

// AC: "비밀번호는 bcrypt로 hash되어 저장된다 (평문 저장 X)"
it('비밀번호는 bcrypt로 hash되어 저장된다', async () => { ... });
```

## 테스트 작성 판단

### 작성해야 하는 신호 (하나라도 해당하면 작성)

- 공통 유틸 / 컴포넌트 / 훅 / 서비스
- 조건 분기 2개 이상
- 회귀 위험 로직 (인증, 결제, 권한 등 보안/데이터 무결성 영향)
- 과거 버그 이력 있는 영역
- 복잡한 상태 전이 (state machine, multi-step flow)

### 생략해도 되는 경우

- 단순 props 전달 래퍼 컴포넌트
- 외부 라이브러리 내부 동작 위임 (해당 라이브러리 자체 테스트 신뢰)
- 멀티 화면 플로우 → e2e로 (도입 시점에)

### 1인 풀팀 컨텍스트의 우선순위

1. **백엔드 service의 비즈니스 로직** — 회귀 위험 최대. 우선 작성.
2. **공통 유틸 / 보안 관련 헬퍼** — bcrypt wrapping, JWT 발급 등
3. **컨트롤러** — DTO validation + 응답 형태 검증. 통합 테스트 성격.
4. **모바일 화면** — Phase 후속. native module mocking 학습 후.

## 파일 위치

### 백엔드

- **단위 테스트**: 소스 파일 옆 (`auth.service.ts` ↔ `auth.service.spec.ts`)
- **통합 테스트** (controller): `apps/server/test/` (NestJS 기본 디렉토리)
- 확장자: `*.spec.ts`

### 모바일 (Phase 2 4.6+)

- **유틸 / 훅**: 소스 파일 옆 (`use-trip-form.spec.ts`)
- **컴포넌트**: `__tests__/` 폴더 (`TripCard.test.tsx`)
- 확장자: 유틸은 `.spec.ts`, 컴포넌트는 `.test.tsx`

## 백엔드 Jest 셋업 — 주요 패턴

### 1. NestJS Testing Module

```typescript
import { Test, TestingModule } from '@nestjs/testing';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: createMock<UsersService>() },
        { provide: JwtService, useValue: { sign: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
  });

  it('이메일 + 비밀번호로 가입하면 TokenPair를 반환한다', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    // ...
  });
});
```

### 2. Repository mocking

- TypeORM repository는 그대로 mock 객체로 주입:
  ```typescript
  { provide: getRepositoryToken(User), useValue: createMock<Repository<User>>() }
  ```
- 단위 테스트에선 DB 안 띄움. 통합 테스트만 실제 DB (Phase 후속).

### 3. 외부 서비스 mocking

- `JwtService`, `ConfigService` 등 NestJS 의존성은 mock으로 주입
- `bcrypt`는 그대로 사용 (cost factor 낮춰서 — `bcrypt.hash(p, 4)` 등 테스트용)

## 모바일 Jest 셋업 — 주요 패턴 (Phase 2 4.6+)

### 1. 컴포넌트 테스트

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';

describe('TripCard', () => {
  it('여행 제목과 사진 개수를 표시한다', () => {
    render(<TripCard trip={mockTrip} />);
    expect(screen.getByText('도쿄 여행')).toBeOnTheScreen();
    expect(screen.getByText('3장')).toBeOnTheScreen();
  });

  it('카드 누르면 onPress가 호출된다', () => {
    const handlePress = jest.fn();
    render(<TripCard trip={mockTrip} onPress={handlePress} />);
    fireEvent.press(screen.getByText('도쿄 여행'));
    expect(handlePress).toHaveBeenCalledWith(mockTrip);
  });
});
```

### 2. 쿼리/뮤테이션 훅 테스트 (React Query 도입 시)

```typescript
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

it('useGetTripsQuery는 trips 목록을 반환한다', async () => {
  const { result } = renderHook(() => useGetTripsQuery(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data).toHaveLength(3);
});
```

### 3. Native module mocking

- `expo-secure-store`, `expo-image-picker` 등 native module은 jest setup에서 mock
- jest-expo preset이 기본 mock 다수 제공. 부족하면 `jest.config.js`의 `moduleNameMapper` / `setupFiles` 활용

### 4. API mocking — msw 또는 mock fetch

- 옵션 A: **msw** — request handler 정의, 실제 fetch 동작 그대로
- 옵션 B: **`jest.spyOn(global, 'fetch')` mock** — 간단한 케이스만

→ Phase 2 4.6 도입 시 결정. 학습 가치는 msw가 큼.

## CI 통합

`.github/workflows/ci.yml`에 단계 추가 (Phase 2 4.2 셋업 시):

```yaml
- name: Test
  run: pnpm test
```

- Typecheck → Lint → Test 순서
- 실패 시 PR 머지 차단

## 커버리지

- **80%+ 강제 X** — 무의미한 테스트 양산 위험
- **AC 기반 = 자연스럽게 의미 있는 커버리지 확보**
- 단, **인증/권한/결제 등 critical 도메인은 100% 목표**

## PR 전 실행 순서

```bash
pnpm typecheck && pnpm lint && pnpm test
```

전부 통과해야 머지.

## 하면 안 되는 것

- **테스트 없이 비즈니스 로직 변경** (인증/권한/결제 등 critical 영역)
- **테스트만을 위한 코드 변경** (private을 public으로, 등) — 차라리 통합 테스트로 검증
- **외부 라이브러리 내부 동작 테스트** — 그건 라이브러리 책임
- **테스트 안에서 다른 테스트 결과에 의존** — 각 테스트는 독립
- **`beforeAll` 남용** — `beforeEach`로 격리. mock 재사용성보다 격리성 우선
- **production DB / 외부 API 직접 호출하는 테스트** — 항상 mock 또는 testcontainers
