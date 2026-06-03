# React Native 기본 문법 (React/Next dev 진입용)

> **작성일**: 2026-06-03
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #6 모바일 네이티브 (PROJECT_ROOT 2장) — RN 첫 진입
> **관련 문서**: [Phase 2 Spec 4.6](../specs/phase-02-core-features.md), [Expo Router 패턴](expo-router-patterns.md)

---

## 한 줄 요약

본인이 **React/Next.js 2년차 — 익숙한 자산은 그대로** 사용 (React hooks, JSX, TS, prop drilling 패턴 등). **RN의 새 영역은 컴포넌트 + 스타일링 시스템**: web의 `<div>`/`<p>` 대신 `<View>`/`<Text>`, CSS 대신 `StyleSheet`, flex 기본 방향이 column. 학습 곡선의 80%는 이 매핑 + 모바일 환경 고려(키보드/안전영역/스크롤 명시).

## 우리 프로젝트에서 어디에 쓰이는가

Phase 2 4.6 모바일 화면 작업 전체 — Login/Signup/Moments/Create/Detail/Photo 모든 화면이 RN 컴포넌트 + StyleSheet 사용.

## 어떻게 동작하는가

### Web ↔ RN 컴포넌트 매핑 (핵심)

| Web (익숙)                          | RN                                          | 의미                                              |
| ----------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| `<div>`                             | **`<View>`**                                | 박스 컨테이너                                     |
| `<p>`/`<span>`/`<h1>` (자유 string) | **`<Text>`**                                | **모든 텍스트 반드시 `<Text>` 안에** ← RN 핵심 룰 |
| `<input>`                           | **`<TextInput>`**                           | 입력 — `keyboardType="email-address"` 등          |
| `<button>`                          | **`<Pressable>`** / `<TouchableOpacity>`    | `onPress` + `({pressed})` active state            |
| `<img>`                             | `<Image>` (RN) / **`<Image>`** (expo-image) | source 객체 — `{uri}` 또는 `require()`            |
| `<a>`                               | `<Link>` (expo-router)                      | 거의 동일 props                                   |
| 자동 스크롤                         | **`<ScrollView>` / `<FlatList>`**           | 명시 — View는 스크롤 X                            |
| 자동 안전영역                       | **`<SafeAreaView>`**                        | 노치/홈인디케이터 회피 명시                       |
| 자동 키보드 회피                    | **`<KeyboardAvoidingView>`**                | TextInput 입력 시 키보드 회피                     |
| `window.alert()`                    | **`Alert.alert()`**                         | RN built-in modal                                 |
| `<dialog>`                          | **`<Modal>`**                               | RN built-in                                       |
| 자동 status bar                     | **`<StatusBar>`** (expo)                    | 상단 시계/배터리 색상                             |

### 스타일링 매핑

| Web (CSS)                                      | RN                                             |
| ---------------------------------------------- | ---------------------------------------------- |
| `className="bg-blue-500"` (Tailwind)           | `style={styles.button}` (StyleSheet.create)    |
| `style={{ backgroundColor: 'blue' }}` (inline) | 동일하게 가능                                  |
| CSS 단위 (`16px`, `1rem`, `50%`)               | **숫자만** (`16`) — density-independent pt     |
| `kebab-case` 키 (`background-color`)           | **camelCase** (`backgroundColor`)              |
| `display: flex; flex-direction: row`           | **flex 기본 + `flexDirection: 'column'` 기본** |
| `gap: 8px`                                     | `gap: 8` (RN 0.71+ 지원)                       |
| `overflow: auto`                               | 별도 컴포넌트 (`ScrollView`)                   |
| hover (마우스)                                 | 없음 — `Pressable`의 pressed state             |
| 미디어 쿼리                                    | `Dimensions.get('window')` + JS 분기           |

### StyleSheet.create — 객체로 스타일

```tsx
import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1, // 부모 전체
    backgroundColor: '#fff',
    padding: 24,
  },
  title: {
    fontSize: 32, // 단위 X (px 아님)
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
});

return (
  <View style={styles.container}>
    <Text style={styles.title}>안녕하세요</Text>
  </View>
);
```

### Flex — 기본이 column (가장 헷갈리는 차이)

```tsx
// RN의 default
<View>  {/* flex 자동, flexDirection: 'column' */}
  <View>위</View>
  <View>중간</View>
  <View>아래</View>
</View>

// row로 만들려면
<View style={{ flexDirection: 'row' }}>
  <View>왼쪽</View>
  <View>오른쪽</View>
</View>
```

Web의 박스 모델 `display: block` (위→아래)과 비슷하지만 **flex로 동작** — flex 옵션들 (`alignItems`, `justifyContent` 등) 다 사용 가능.

### 조건부 스타일 — 배열

```tsx
// web의 cn() / clsx 대응
<View style={[styles.button, pressed && styles.buttonPressed, disabled && styles.buttonDisabled]}>
  ...
</View>
```

뒤의 값이 앞 값을 override. `false`/`undefined`/`null`은 무시.

## 핵심 개념

### 모든 텍스트는 `<Text>` (RN 핵심 룰)

```tsx
// ❌ crash 또는 unrendered
<View>안녕하세요</View>

// ✅
<View>
  <Text>안녕하세요</Text>
</View>
```

JSX 안 string은 무조건 `<Text>` 자식이어야. 다른 컴포넌트 children에 string 직접 박으면 crash 또는 보이지 않음.

### Pressable의 ({pressed}) 패턴

```tsx
<Pressable
  onPress={() => console.log('탭')}
  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
>
  <Text style={styles.buttonText}>탭</Text>
</Pressable>
```

`style`이 **함수** — pressed state를 인자로 받아 스타일 동적 변경. web의 hover가 없으니 pressed state로 active feedback.

### SafeAreaView + KeyboardAvoidingView 패턴

iOS 노치 + 홈 인디케이터 회피 + 키보드 안 가리게 — 모바일 표준:

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView, Platform } from 'react-native';

return (
  <SafeAreaView style={{ flex: 1 }}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView>...폼 등 입력 필드들</ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
);
```

### TextInput — onChangeText로 string 직접

```tsx
const [email, setEmail] = useState('');

<TextInput
  value={email}
  onChangeText={setEmail} // ← e.target.value 아님
  placeholder="user@trailog.app"
  keyboardType="email-address" // ← 키보드 타입 변경
  autoCapitalize="none"
  secureTextEntry={isPassword} // ← password 마스킹
  editable={!isLoading} // ← disabled 대응
/>;
```

### Image — source 객체

```tsx
// 원격 이미지
<Image source={{ uri: 'https://...' }} style={{ width: 100, height: 100 }} />

// 로컬 이미지 (정적 — require)
<Image source={require('./logo.png')} style={...} />

// expo-image (권장 — 캐시 + 더 좋음)
import { Image } from 'expo-image';
<Image source={{ uri }} contentFit="cover" transition={200} />
```

### FlatList — 가상화 리스트

```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <Card item={item} />}
  numColumns={3} // grid
  columnWrapperStyle={{ gap: 8 }}
  onRefresh={handleRefresh} // pull-to-refresh
  refreshing={isRefreshing}
  ListEmptyComponent={<EmptyState />} // data 빈 배열 시
/>
```

Web의 `.map`보다 — **화면 밖 item 자동 unmount → 메모리 효율**. 작은 리스트 (<20개)는 `<ScrollView>` + `.map`도 OK.

## 참조 (Web) 패턴 비교 — Trailog (RN)

| 항목        | 참조 (Next.js + Tailwind + Radix)                | Trailog (RN + StyleSheet)                    |
| ----------- | ------------------------------------------------ | -------------------------------------------- |
| Form UI     | shadcn `<Form><FormField>` (RHF + Radix wrapper) | RHF `<Controller>` 직접                      |
| Input       | shadcn `<MainInput>` (Tailwind)                  | RN `<TextInput>` + StyleSheet                |
| Button      | `<MainButton>` (Tailwind hover/active)           | RN `<Pressable>` (pressed state)             |
| 텍스트      | `<h2>` / `<p>` (HTML)                            | `<Text>` (모든 텍스트 강제)                  |
| 클릭 이벤트 | `onClick`                                        | `onPress`                                    |
| 스타일      | Tailwind class                                   | `StyleSheet.create` 객체                     |
| Theme       | Tailwind config                                  | (Phase 후속 — 4.8 폴리시 wave)               |
| 모달        | `<Dialog>` (Radix)                               | RN `<Modal>` + `react-native-modal`          |
| Toast       | react-toastify                                   | (Phase 후속 — react-native-toast-message 등) |

→ **개념(form/state/router)은 거의 동일**. 도구(컴포넌트/스타일)만 달라짐. 본인 React/Next 자산 그대로 살아남.

## 흔한 함정

1. **`<View>{text}</View>` (텍스트 직접)** — crash / unrendered. `<Text>` 감싸기.
2. **CSS 단위 (`'16px'`)** — RN은 숫자만. `'16px'`는 invalid.
3. **flexDirection 누락** — 기본이 column이라 row로 박으려면 명시.
4. **`display: 'flex'` 박음** — RN은 모든 View가 flex. 명시 X.
5. **`width: '50%'`** — 일부 케이스만 동작. flex 비율(`flex: 1`)이 권장.
6. **`onChange={e => ...}` 사용** — TextInput은 `onChangeText` (string 직접).
7. **`<img>` 사용** — `<Image>`로. source 객체 형태.
8. **SafeAreaView 누락** — iPhone 노치 영역에 콘텐츠 가림.
9. **KeyboardAvoidingView 누락** — TextInput 탭 시 키보드가 입력 영역 가림.
10. **ScrollView 무한 vs FlatList** — 작은 리스트 ScrollView OK, 큰 리스트는 FlatList (메모리).
11. **hover 효과 박음** — 모바일엔 hover 개념 X (Pressable의 pressed).
12. **`Alert.alert`가 web에서 동작 X** — web 호환 시점에 fallback.
13. **`Dimensions.get('window')`가 회전 시 미반영** — `useWindowDimensions()` hook 사용.
14. **CSS background-image (gradient/패턴)** — RN 없음. `expo-linear-gradient` 별도.
15. **box-shadow** — `elevation` (Android) + `shadowColor/Offset/Opacity/Radius` (iOS) 분리.

## 더 파볼 거리

- **NativeWind** — Tailwind를 RN에 (참조 패턴 정복 + 4.8 폴리시 wave 후보)
- **Restyle / Tamagui** — RN 디자인 system lib (theme 변수 + variant)
- **Reanimated 3** — animation 표준 (worklet 기반 60fps)
- **Gesture Handler** — swipe/pinch/long-press 등 모든 제스처
- **Skia** — 고급 그래픽 (Phase 후속)
- **Accessibility** — `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`
- **i18n** — react-i18next + intl-pluralrules
- **Performance** — Hermes 엔진 + FlashList (FlatList보다 빠름)

## 참고 링크

- [React Native 공식 문서](https://reactnative.dev/docs/getting-started)
- [Expo SDK 56 docs](https://docs.expo.dev/)
- [react-native-safe-area-context](https://github.com/AppAndFlow/react-native-safe-area-context)
- [참조 패턴 메모리 `관련 메모리`](../../.claude/CLAUDE.md) (Trailog 룰)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
