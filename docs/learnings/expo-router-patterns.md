# Expo Router 패턴 — File-based 라우팅 + Layout + Dynamic Route

> **작성일**: 2026-06-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #6 모바일 네이티브 (PROJECT_ROOT 2장) — 모바일 라우팅
> **관련 문서**: [Phase 2 Spec 4.6](../specs/phase-02-core-features.md), [RN 기본 문법](react-native-fundamentals-for-web-devs.md)

---

## 한 줄 요약

**Expo Router** = Next.js App Router의 모바일 버전. `src/app/` 디렉토리의 파일 구조가 곧 라우트, `_layout.tsx`로 layout 중첩, `(group)`으로 URL에 영향 없는 그룹, `[param]`으로 동적 라우트. **본인이 Next App Router에 익숙하면 학습 곡선 최소** — 거의 동일한 컨벤션.

## 우리 프로젝트에서 어디에 쓰이는가

Phase 2 4.6 D1에 라우트 골격 신설:

```
apps/mobile/src/app/
├── _layout.tsx                  # Root Stack + Provider 등록
├── index.tsx                    # 진입 분기 (token 있음 → tabs, 없음 → auth)
├── (auth)/                      # 인증 흐름 group (URL에 안 나옴)
│   ├── login.tsx
│   └── signup.tsx
├── (tabs)/                      # 인증 후 메인 탭 group
│   ├── _layout.tsx              # Tabs navigator (moments + map)
│   ├── moments.tsx
│   └── map.tsx
├── moments/
│   ├── [momentId].tsx           # 동적 — /moments/abc-123
│   └── create.tsx               # /moments/create
└── photos/
    └── [photoId].tsx            # 동적 — /photos/xyz-456?momentId=...
```

## 어떻게 동작하는가

### File-based routing 매핑

| 파일 경로                    | URL                                 |
| ---------------------------- | ----------------------------------- |
| `app/index.tsx`              | `/`                                 |
| `app/(auth)/login.tsx`       | `/login` (`(auth)`는 URL에 안 나옴) |
| `app/(tabs)/moments.tsx`     | `/moments`                          |
| `app/moments/create.tsx`     | `/moments/create`                   |
| `app/moments/[momentId].tsx` | `/moments/abc-123` (param)          |
| `app/photos/[photoId].tsx`   | `/photos/xyz-456`                   |

### `_layout.tsx` — Next App Router의 `layout.tsx` 동일

자식 라우트 감싸는 wrapper. Provider 등록, navigator 선택, header 옵션 등.

```tsx
// app/_layout.tsx (root)
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </QueryClientProvider>
  );
}
```

```tsx
// app/(tabs)/_layout.tsx
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="moments" options={{ title: 'Moments' }} />
      <Tabs.Screen name="map" options={{ title: 'Map' }} />
    </Tabs>
  );
}
```

### `(group)` 컨벤션 — URL에 영향 X, layout 분리만

`(auth)` 와 `(tabs)`는 URL에 안 나옴. **layout 분리 + 코드 organization** 용도. Next App Router의 route groups와 동일.

Trailog 사용 사유:

- `(auth)/*` — 미인증 화면 group (헤더 X)
- `(tabs)/*` — 인증 후 메인 (Tabs navigator)

### `[param]` 동적 라우트

`[momentId].tsx` → `/moments/abc-123` 진입 시 `momentId='abc-123'`. `useLocalSearchParams`로 읽음.

```tsx
import { useLocalSearchParams } from 'expo-router';

const { momentId } = useLocalSearchParams<{ momentId: string }>();
// + query string도 같이: ?momentId=... 도 동일하게 받음
const { photoId, momentId } = useLocalSearchParams<{ photoId: string; momentId?: string }>();
```

### Navigation API

| 패턴                               | 의미                                           |
| ---------------------------------- | ---------------------------------------------- |
| `<Link href="/path">텍스트</Link>` | 선언적 — 자식이 텍스트 / Pressable (`asChild`) |
| `useRouter().push('/path')`        | 명령형 — 새 화면 푸시 (뒤로가기 가능)          |
| `useRouter().replace('/path')`     | 명령형 — 화면 교체 (뒤로가기 불가)             |
| `useRouter().back()`               | 뒤로                                           |

```tsx
// 정적
<Link href="/(auth)/login">로그인</Link>;

// 동적 + query
router.push(`/photos/${photoId}?momentId=${momentId}`);
```

### Stack / Tabs / Drawer navigator

|            | 의미                                    |
| ---------- | --------------------------------------- |
| **Stack**  | 화면 push/pop — 뒤로가기 가능 (default) |
| **Tabs**   | 하단 탭 — 화면 전환 (state 보존)        |
| **Drawer** | 좌측 슬라이드 (햄버거 메뉴 패턴)        |

## 핵심 개념

### typed routes — typegen 기반 라우트 타입 안전

`app.json`의 `experiments.typedRoutes: true`로 활성. dev server 첫 부팅 시 `.expo/types/router.d.ts` 자동 생성 → `Link href` 등에 타입 추론.

```jsonc
// app.json
{
  "expo": {
    "experiments": { "typedRoutes": true },
  },
}
```

**함정**: typegen은 dev server 부팅 후에만 박힘. 시작 전엔 type 불일치 → `Href` cast 필요.

```tsx
import { Link, type Href } from 'expo-router';
<Link href={'/(auth)/login' as Href}>로그인</Link>;
```

dev server 한 번 띄우면 typegen → cast 제거 가능.

### 인증 분기 redirect 패턴

Trailog index.tsx — 진입 시 token 확인 후 redirect:

```tsx
export default function HomeScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    authStorage.getTokens().then((tokens) => {
      router.replace((tokens ? '/(tabs)/moments' : '/(auth)/login') as never);
    });
  }, [router]);

  return <ActivityIndicator size="large" />;
}
```

`router.replace`로 — 뒤로가기로 로그인 화면 돌아가지 못하게.

## 참조 패턴 비교 — Next.js App Router

Trailog (Expo Router) ↔ 참조 (Next.js App Router) 거의 동일. 차이는 **모바일 vs 웹 컴포넌트 차이**가 전부:

| 항목                        | Next App Router           | Expo Router                           |
| --------------------------- | ------------------------- | ------------------------------------- |
| File-based                  | ✅                        | ✅ (동일)                             |
| `_layout` / `layout`        | `layout.tsx`              | `_layout.tsx`                         |
| `(group)`                   | ✅                        | ✅                                    |
| `[param]` 동적              | ✅                        | ✅                                    |
| useRouter / useSearchParams | `next/navigation`         | `expo-router`                         |
| Link                        | `next/link`               | `expo-router` (props 거의 동일)       |
| 미들웨어 redirect           | `middleware.ts` (서버 측) | ❌ (모바일은 서버 X — 클라 useEffect) |
| 정적 export                 | SSG/SSR/RSC               | 항상 CSR (모바일 client only)         |

→ Next App Router 익숙하면 Expo Router 진입 시간 매우 짧음. **참조 패턴 그대로 모바일에 transfer 가능**.

## 흔한 함정

1. **`<Text>` 강제 RN 룰을 Link 안에 적용** — `<Link>` 자체는 텍스트 children 받지만 RN에선 직접 string 못 박음. 안의 자식을 `<Text>`로 감쌈. 또는 `<Link asChild>` + 자식 `<Pressable>`.
2. **typedRoutes typegen 미생성 상태** — dev server 첫 부팅 전엔 `as Href` 또는 `as never` cast.
3. **`(group)` 안의 `_layout.tsx` 누락** — 명시 없으면 부모 layout 그대로. 명시하면 별도 navigator 가능.
4. **`router.push` vs `replace`** — push는 뒤로가기 가능 (Stack에 쌓임), replace는 교체. 인증 분기엔 replace.
5. **`useLocalSearchParams` 타입** — 모두 string으로 박힘 (number/Date 자동 변환 X). 수동 parsing 필요.
6. **Query string 받기** — `[param]` 외에 query (`?key=val`)도 `useLocalSearchParams`에 동일하게 박힘.
7. **deep link 진입 시 인증 layer 누락** — 외부 link로 `/photos/xxx` 직접 진입 시 인증 X 가능. `(tabs)` group layout에 token guard 박을 가치 (Phase 후속).
8. **Modal 화면** — `presentation: 'modal'` 옵션으로 sheet/modal 흐름. iOS 표준.
9. **iOS의 swipe-to-back gesture** — Stack 자동. 일부 화면(인증 등)에 막고 싶으면 `gestureEnabled: false`.
10. **headerRight 등 옵션** — Stack.Screen options에 박음. Trailog는 headerShown:false 후 자체 헤더 — 자유도 ↑.

## 더 파볼 거리

- **typed routes 정밀 활용** — `Href`/`Pathname` 타입 + dynamic param 타입 안전
- **Modal presentation** — sheet/modal/transparentModal 옵션
- **Deep link + universal link** — `expo-linking` + iOS Associated Domains + Android App Links
- **Navigation 상태 persist** — 앱 재시작 시 마지막 화면 복귀 (전문 lib 또는 자체)
- **인증 가드 패턴** — `(tabs)/_layout`에서 useEffect로 token 검사 + redirect
- **transition / animation** — Reanimated + Gesture Handler로 화면 전환 커스텀

## 참고 링크

- [Expo Router 공식 문서](https://docs.expo.dev/router/introduction/)
- [Next.js App Router (비교용)](https://nextjs.org/docs/app)
- [File-based routing 개념](https://docs.expo.dev/router/create-pages/)
- [typedRoutes 가이드](https://docs.expo.dev/router/reference/typed-routes/)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
