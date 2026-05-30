# React Native / Expo 모바일 룰 (`apps/mobile/`)

Expo SDK 56 + Expo Router 기반. 본인 React/Next.js 2년차 → RN 학습 컨텍스트.

## 네이밍 규칙

| 대상             | 규칙                           | 예시                                          |
| ---------------- | ------------------------------ | --------------------------------------------- |
| 컴포넌트 파일    | PascalCase                     | `TripCard.tsx`                                |
| 컴포넌트 폴더    | kebab-case                     | `src/components/trip-card/`                   |
| 훅 파일          | camelCase + `use` prefix       | `useAuthState.ts`                             |
| 서비스/유틸 파일 | kebab-case                     | `api-client.ts`, `auth-storage.ts`            |
| 라우트 파일      | kebab-case (Expo Router 규칙)  | `app/(tabs)/trips.tsx`, `app/photos/[id].tsx` |
| 이벤트 핸들러    | `handle` + 동사 + 명사         | `handlePressSubmit`, `handleChangeText`       |
| 이벤트 props     | `on` + 동사 + 명사             | `onPress`, `onSubmit`                         |
| 쿼리 훅          | `useGet{Feature}Query`         | `useGetTripsQuery` (Phase 2 4.6+)             |
| mutation 훅      | `use{Action}{Feature}Mutation` | `useCreateTripMutation` (Phase 2 4.6+)        |
| 상수             | UPPER_SNAKE_CASE               | `API_URL`, `AUTH_STORAGE_KEYS`                |
| Props 인터페이스 | `{ComponentName}Props`         | `TripCardProps`                               |

### Web ↔ Mobile 어휘 차이 (참조 React 비교 학습 컨텍스트)

| 의미        | Web (React/Next.js)           | Mobile (RN/Expo)                                       |
| ----------- | ----------------------------- | ------------------------------------------------------ |
| 페이지 진입 | `page.tsx`                    | `app/(tabs)/index.tsx` (Expo Router)                   |
| 클릭 이벤트 | `onClick`                     | `onPress`                                              |
| 입력 변경   | `onChange`                    | `onChangeText`                                         |
| 스타일링    | Tailwind / CSS-in-JS          | `StyleSheet.create` / NativeWind (도입 시)             |
| 라우팅      | `<Link href>` / `router.push` | `<Link href>` / `router.push` (Expo Router, 어휘 동일) |
| 환경변수    | `NEXT_PUBLIC_*`               | `EXPO_PUBLIC_*` (build time inline 동일 사고)          |
| 로컬 저장소 | `localStorage` / cookie       | `AsyncStorage` (일반) / `SecureStore` (token/비밀번호) |
| 네트워킹    | `fetch` / `axios`             | `fetch` (동일) — 단 cookie 자동 첨부 X → Bearer header |

## 디렉토리 구조

```
apps/mobile/
├── app/                           # Expo Router 라우트 (file-based routing)
│   ├── _layout.tsx                # 루트 레이아웃
│   ├── (auth)/                    # 인증 그룹 (URL prefix X)
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/                    # 탭 그룹
│   │   ├── _layout.tsx            # 탭 바
│   │   ├── trips.tsx              # 여행 리스트
│   │   └── map.tsx                # 지도
│   └── photos/
│       └── [id].tsx               # 사진 상세 (동적 라우트)
├── src/
│   ├── lib/                       # 도메인 무관 유틸/client
│   │   └── auth/                  # 인증 client (Phase 2 4.1)
│   ├── components/                # 전역 재사용 컴포넌트
│   ├── hooks/                     # 전역 재사용 훅
│   └── features/                  # 도메인별 컴포넌트/훅 (Phase 2 4.6+ 도입 시)
│       ├── trips/
│       │   ├── components/
│       │   └── hooks/
│       └── photos/
└── assets/                        # 이미지/폰트
```

### 코로케이션 vs 전역

- 처음엔 **전역(`src/components/`)** 에 두고, **2개 이상 화면에서 실제 중복**될 때 유지.
- 한 화면에서만 쓰는 큰 컴포넌트는 `src/features/{domain}/components/`로 코로케이션.
- **너무 일찍 코로케이션 X** — Phase 2 도메인 4~5개 예상, 처음부터 깊은 폴더 X.

## 컴포넌트 설계 원칙

### 파일 하나에 컴포넌트 하나

`export default` 또는 `export const` 1개. 서브 컴포넌트는 별도 파일.

**예외**: 순수 렌더링 헬퍼 (인라인 JSX 변수 수준), Expo Router 파일 컨벤션.

### 라우트 파일(`app/**/*.tsx`)은 화면 조합만

로직, 상태, 큰 훅을 라우트 파일에 직접 넣지 않는다. 라우트 파일은 **레이아웃 조합 + 데이터 fetch 호출 + 자식 컴포넌트 전달**만.

복잡한 로직은:

- 커스텀 훅으로 추출 (`useTripDetail`, `useTripActions`)
- 자식 컴포넌트로 분리 (`<TripHeader />`, `<TripPhotoGrid />`)

### 단일 책임 — 분리 기준

아래 중 **2가지 이상** 담당하면 컴포넌트 분리:

- 서버 데이터 fetch (`useQuery`, `useMutation` 직접 호출)
- 사용자 인터랙션 (핸들러 3개 이상)
- 복잡한 조건 렌더링 (3개 이상 분기)
- 폼 상태 관리

### Props 설계

- Props 7개 초과 시 관심사별 분리 (`data`, `actions`, `state` 등 그룹)
- `optional`은 실제로 없는 경우가 있을 때만. **타입 에러 회피용 `?` 금지**
- boolean props 3개 이상이면 합성 패턴 또는 variant 단일화

## 컴포넌트 내 코드 순서

```typescript
export function TripCard({ trip, onPress }: TripCardProps) {
  // 1. 훅 (useQuery → useState → useRef → useRouter → 기타)
  const router = useRouter();
  const { data: photos } = useGetTripPhotosQuery(trip.id);
  const [expanded, setExpanded] = useState(false);

  // 2. 파생 상태
  const coverPhoto = photos?.[0];
  const photoCount = photos?.length ?? 0;

  // 3. 이벤트 핸들러
  const handlePressCard = () => {
    onPress?.(trip);
    router.push(`/trips/${trip.id}`);
  };

  // 4. early return (로딩/에러/빈 상태)
  if (!coverPhoto) return <EmptyTripCard trip={trip} />;

  // 5. 렌더링
  return (
    <Pressable onPress={handlePressCard}>
      {/* ... */}
    </Pressable>
  );
}
```

훅 그룹 간 빈 줄로 구분. 같은 종류는 연속.

## 커스텀 훅 책임 분류 (Phase 2 4.6+ React Query 도입 시)

| 훅 타입         | 명명                           | 포함 내용                                                 |
| --------------- | ------------------------------ | --------------------------------------------------------- |
| 서버 read       | `useGet{Feature}Query`         | `useQuery`, `select`, `enabled`                           |
| 서버 write      | `use{Action}{Feature}Mutation` | `useMutation`, `invalidate`, 에러 처리                    |
| 폼 상태         | `use{Feature}Form`             | `useForm` (react-hook-form), `zodResolver`, submit 핸들러 |
| 클라이언트 상태 | `use{Feature}State`            | `useState`, `useReducer`                                  |
| 화면 aggregator | `use{ScreenName}`              | 위 훅들 조합 (라우트 파일에서 호출)                       |

### 훅 반환값

- Query/Mutation 훅: TanStack 반환값 그대로 (`{ data, isLoading, error, ... }`)
- State 훅: 배열 아닌 **객체**로 (`{ value, setValue, reset }`)
- Aggregator 훅: 필요한 값/핸들러를 객체로

## useEffect 사용 제한

### 허용

- 외부 이벤트 리스너 (Expo `AppState`, `Keyboard` 등)
- 타이머 (`setInterval`, `setTimeout`)
- 서드파티 라이브러리 연동 (지도 SDK 등)
- 포커스/스크롤 제어
- 데이터 기반 폼 초기화 (최초 1회만)

### 금지

- 파생 상태 동기화 → 변수로 계산 (`const photoCount = photos.length`)
- 이벤트 핸들러로 처리 가능한 로직 → 핸들러로
- props 변경 시 state 리셋 → `key` prop 사용
- deps 배열 린트 무시 (`eslint-disable-next-line`)

## 조건부 렌더링

- **단순 노출/숨김**: `{condition && <Component />}` — `&&` 앞값이 0이면 RN에선 텍스트 노드로 노출되어 에러. 항상 `count > 0 &&` 형태로.
- **둘 중 하나**: 삼항 (`isLoggedIn ? <Home /> : <Login />`)
- **3개 이상 분기**: 컴포넌트 분리 또는 객체 매핑 (`Record<Status, React.ComponentType>`)
- **중첩 삼항 금지** — 변수로 분리

## 이벤트 핸들러

- **1줄 이하**: 인라인 OK (`<Button onPress={() => setExpanded(true)} />`)
- **2줄 이상 / 비동기 / 여러 상태 변경 / 재사용**: 핸들러 추출

## 컴포넌트 크기 제한

| 기준       | 값    | 초과 시                    |
| ---------- | ----- | -------------------------- |
| 파일 줄 수 | 300줄 | 훅 추출 또는 컴포넌트 분리 |
| 핸들러 수  | 5개   | 커스텀 훅으로 추출         |
| JSX 깊이   | 4단계 | 하위 컴포넌트로 분리       |
| Props 개수 | 7개   | 관심사별 그룹 분리         |

## 메모이제이션 기준

**기본적으로 사용하지 않는다.** 측정 없는 최적화 X.

`useMemo` 사용:

- 대량 배열 정렬/필터 (100개+)
- 자식에 내려주는 객체/배열 (참조 안정성 필요할 때)
- `useEffect`/`useCallback` deps에 들어가는 파생 객체

`useCallback` 사용:

- `React.memo` 자식에 전달하는 핸들러
- `useEffect` deps에 함수가 필요할 때
- 이벤트 리스너 등록/해제 함수 (`useEffect` 안에서 `removeEventListener` 호출)

## 라우팅 (Expo Router)

- 경로 문자열 하드코딩 금지 → 경로 상수 사용 (`src/constants/routes.ts` Phase 2 4.6+ 도입)
- 새 화면 추가 시:
  1. `app/{path}.tsx` 생성
  2. 경로 상수 추가
  3. 탭/네비게이션 링크 반영
  4. 인증 가드 확인 (보호된 라우트인가)

## API 호출

- **`apiRequest` wrapper 사용** (`apps/mobile/src/lib/auth/`) — 자동 token 첨부 + 401 refresh
- **컴포넌트에서 `fetch` 직접 호출 금지** — 항상 wrapper 거치기 (또는 wrapper를 쓰는 service layer)
- **Phase 2 4.6+ React Query 도입 후**: `useQuery({ queryKey, queryFn: () => apiRequest(...) })` 패턴

## 환경변수

- **`EXPO_PUBLIC_*` 만 클라에 노출** (build time inline). 나머지는 빌드 시 미포함.
- **비밀 키는 절대 `EXPO_PUBLIC_*` prefix로 두지 말 것** — 빌드에 그대로 박힘.
- 직접 참조 패턴: `process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'`

## 보안 저장소

- **token / 비밀번호 / 민감 정보**: `expo-secure-store` (iOS Keychain + Android Keystore)
- **일반 데이터** (사용자 설정, 캐시 등): `AsyncStorage` (Phase 후속 도입 시)
- **MMKV** (`react-native-mmkv`): 성능 critical할 때 검토 (Phase 후속)

## 코드 수정 시 같이 손볼 것

수정한 파일 안에서 발견하면 같은 commit에 정리:

- `any` 사용 → `unknown` + 타입 가드 또는 구체 타입
- `process.env.X` 직접 참조 (EXPO_PUBLIC 외) — 부적절
- `<View onClick>` (RN엔 없음) → `<Pressable onPress>`
- `<Text>` 없이 문자열 — RN에서 에러. `<Text>` 감싸기
- 인라인 스타일 객체 (`style={{ ... }}`) 중복 → `StyleSheet.create`

**별도 commit으로 분리**:

- 컴포넌트 파일 분리
- 훅 추출
- 테스트 backfill

## 하면 안 되는 것

- **`<View>` 내부에 raw 문자열** — RN에선 항상 `<Text>` 감싸기
- **인라인 스타일 객체 다용** — 매 렌더마다 새 객체 생성 → 자식 리렌더 유발. `StyleSheet.create` 사용
- **`AsyncStorage`에 token/비밀번호** — Keystore/Keychain 아님. 평문에 가깝. `expo-secure-store` 사용
- **`fetch` 직접 호출 + 자체 token 첨부 로직** — `apiRequest` wrapper 거치기
- **boolean props 4개 이상으로 variant 제어** — variant enum 또는 합성 패턴
- **`page.tsx` 라우트 파일에 상태/훅/핸들러 다 박기** — 추출
- **`process.env.NEXT_PUBLIC_*`** — Next.js prefix. Expo는 `EXPO_PUBLIC_*`

## 참조 프론트 코드와의 비교 모드 (메모리)

참조 프론트 코드(React/Next.js) 비교 모드는 **메모리에서 활성화** — 메모리 룰 `관련 메모리` 참고.
매 모바일 코드 작성 시 참조 프론트 패턴 + 보편 RN 대안과 4 컬럼 비교 강제 (참조 / 보편 RN / Trailog 선택 / 사유).
이 룰 파일에는 추상 표현만 박힘.
