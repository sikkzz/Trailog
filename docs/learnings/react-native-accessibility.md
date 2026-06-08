# React Native 접근성 (a11y) — iOS VoiceOver + Android TalkBack

> **작성일**: 2026-06-08
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: #6 모바일 네이티브 + UI/UX 고도화
> **관련 문서**: [Phase 2 Spec 4.8](../specs/phase-02-core-features.md), [모바일 디자인 시스템](mobile-design-system-and-nativewind.md)

---

## 한 줄 요약

모바일 앱은 **VoiceOver(iOS) / TalkBack(Android) 스크린 리더 사용자** + 색맹/저시력/노년 사용자에게도 동작 가능해야 함. React Native는 `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`, `accessibilityState` 4가지 핵심 prop으로 native a11y 시스템과 통합. 추가로 **터치 hit area 최소 44pt**, **컬러 대비 4.5:1 이상**, **폰트 크기 다이나믹** 같은 비-스크린리더 a11y도 같이 신경 써야 함. **법적 요구사항**이기도 함 (한국 + 미국/EU 정부 앱은 a11y 강제).

## 우리 프로젝트에서 어디에 쓰이는가

- **Phase 2 4.8 D6**: 핵심 인터랙티브 요소(Pressable 버튼, TextInput, Link) accessibilityLabel/Role/Hint 추가
- **Phase 후속**: 추가 화면 작성 시 자동 적용 + 색상 대비 검증
- **Phase 4 production 출시 시점**: a11y 인증 검토 (한국 정보접근성 인증, 글로벌 WCAG 2.1)

## 어떻게 동작하는가

### 4가지 핵심 prop

```tsx
<Pressable
  accessibilityRole="button" // 1. 어떤 종류 element인지
  accessibilityLabel="로그인" // 2. 스크린리더가 읽을 텍스트
  accessibilityHint="이메일과 비밀번호 입력 후 로그인" // 3. 추가 행동 설명 (옵션)
  accessibilityState={{ disabled: isLoading, busy: isLoading }} // 4. 상태
  onPress={handleLogin}
>
  <Text>로그인</Text>
</Pressable>
```

| Prop                 | 역할                                             | 필수              |
| -------------------- | ------------------------------------------------ | ----------------- |
| `accessibilityRole`  | element 타입 (button/link/text/header/image 등)  | ⭐ 권장           |
| `accessibilityLabel` | 스크린리더 읽기 텍스트                           | ⭐ Pressable 필수 |
| `accessibilityHint`  | 추가 행동 설명 (한국어 "을(를) 누르면 ~ 합니다") | 옵션              |
| `accessibilityState` | disabled/busy/checked/selected/expanded          | 동적              |

### iOS VoiceOver / Android TalkBack 활성화

| OS      | 활성화                         | 단축키                              |
| ------- | ------------------------------ | ----------------------------------- |
| iOS     | 설정 → 손쉬운 사용 → VoiceOver | 사이드 버튼 3번 클릭 (트리플 클릭)  |
| Android | 설정 → 접근성 → TalkBack       | 음량 ↑ + ↓ 동시 3초 (기종마다 다름) |

→ **개발 시 한 번 켜서 직접 들어보는 게 최선**. label 읽는 흐름 어색하면 정정.

### accessibilityRole 종류

| Role           | 사용                                        |
| -------------- | ------------------------------------------- |
| **button**     | 버튼 — 가장 많음 (모든 Pressable의 default) |
| **link**       | 외부/내부 링크 (router.push 등)             |
| **text**       | 단순 텍스트 (default — 명시 X도 OK)         |
| **header**     | 화면 제목, 섹션 헤더                        |
| **image**      | 이미지 (Image 컴포넌트 default)             |
| **search**     | 검색 입력                                   |
| **adjustable** | 슬라이더, stepper                           |
| **switch**     | 토글 스위치                                 |
| **tab**        | 탭 (Tab Bar 항목)                           |
| **none**       | 스크린리더가 무시                           |

### Trailog 적용 예시

```tsx
// Login 버튼
<Pressable
  accessibilityRole="button"
  accessibilityLabel="로그인"
  accessibilityState={{ disabled: isSubmitting, busy: isSubmitting }}
  onPress={handleSubmit(onSubmit)}
>
  <Text>{isSubmitting ? '로그인 중...' : '로그인'}</Text>
</Pressable>

// + 사진 버튼
<Pressable
  accessibilityRole="button"
  accessibilityLabel={isUploading ? '사진 업로드 중' : '사진 추가'}
  accessibilityHint="갤러리에서 사진 선택"
  accessibilityState={{ disabled: isUploading, busy: isUploading }}
>
  ...
</Pressable>
```

## 핵심 개념

### accessibilityLabel vs Text content

```tsx
// ❌ 안 좋음 — 스크린리더가 "더하기 사진" 또는 "플러스 사진"으로 읽음 (이모지 발음 헷갈림)
<Pressable>
  <Text>＋ 사진</Text>
</Pressable>

// ✅ — 명확한 의도 전달
<Pressable accessibilityLabel="사진 추가">
  <Text>＋ 사진</Text>
</Pressable>
```

→ **시각적 표시와 스크린리더 읽기를 다르게 박을 수 있음** — 의미 우선.

### 비-스크린리더 a11y — 4가지 핵심

1. **터치 hit area 최소 44pt** (Apple HIG) / 48dp (Material)
   - 작은 아이콘 버튼도 hit area 44pt 보장 (`hitSlop` prop 활용)
2. **컬러 대비 (Contrast Ratio)** 최소 4.5:1 (WCAG AA)
   - 흰 배경 + 회색 #999는 대비 ~2.8:1 → fail. `#666` 이상 권장
3. **동적 폰트 크기** — 시스템 폰트 확대 설정 따라가기
   - RN의 `allowFontScaling` (default true), `maxFontSizeMultiplier`로 상한 박기
4. **색 외 신호** — 빨강만으로 에러 X. 아이콘 + 텍스트 같이 ("⚠️ 에러: ...")

### 다이나믹 폰트 + 한국어

```tsx
<Text
  allowFontScaling={true} // default — 시스템 폰트 크기 따라감
  maxFontSizeMultiplier={1.5} // 최대 1.5배까지만 (레이아웃 깨짐 방지)
  className="font-pretendard text-base"
>
  본문 텍스트
</Text>
```

### Trailog의 현재 a11y 수준

| 영역               | 현재 (D6)        | 미흡 / Phase 후속                  |
| ------------------ | ---------------- | ---------------------------------- |
| accessibilityLabel | 핵심 버튼 ✅     | 일부 Pressable 미적용              |
| accessibilityRole  | 버튼 ✅          | 모든 Pressable 자동 button 보장 X  |
| accessibilityHint  | 일부 ✅          | 복잡 흐름엔 부족                   |
| accessibilityState | busy/disabled ✅ | checked/selected 등 미사용         |
| 터치 hit area      | 본문 버튼 OK     | 작은 아이콘 (＋ 등) — hitSlop 검토 |
| 컬러 대비          | 라이트 OK        | 다크 일부 verify 필요              |
| 동적 폰트          | 기본 활성        | maxFontSizeMultiplier 미설정       |
| 색 외 신호         | 텍스트 위주      | 에러 아이콘 추가 검토              |

## 왜 다른 선택지가 아닌 이걸 골랐나

| 대안                           | 거부 사유                                                        |
| ------------------------------ | ---------------------------------------------------------------- |
| a11y 전혀 안 신경 쓰기         | 법적 의무 (특히 한국 정보접근성 인증, EU EAA 2025) + 사용자 차별 |
| 외부 a11y 검증 도구만 (axe 등) | 외부 도구는 추후. 일단 코드 단 기본 적용이 우선                  |
| 모든 Pressable에 자동 prop     | 한 번에 다 박으면 적합도 ↓. 핵심 인터랙티브부터 점진             |

## 흔한 함정

1. **`accessibilityLabel` 없으면 스크린리더가 자식 Text 읽음** — 그게 부정확하면 명시적 label 박기.
2. **아이콘만 있는 버튼 (`＋`, `×`)** — 시각적 의미 명확이지만 스크린리더는 이상하게 읽음. **label 필수**.
3. **`accessibilityHint`는 영어권 표준** — "Double tap to ~" 식. 한국어로는 "을/를 누르면 ~ 합니다" 자연.
4. **`disabled` prop ≠ `accessibilityState.disabled`** — RN의 `disabled`는 onPress 차단만, 스크린리더에겐 따로 알려야.
5. **모든 Text에 role 박는 것은 over** — `accessibilityRole="text"`는 default라 명시 X.
6. **focusable element 충돌** — 부모/자식 둘 다 accessible이면 스크린리더 헷갈림. `accessibilityElementsHidden` 활용.
7. **`importantForAccessibility` (Android)** — 부모만 읽고 자식 무시 — "no-hide-descendants" 가 표준.
8. **이미지의 alt** — `accessibilityLabel="..."` (RN에선 `alt` X). 의미 없는 deco 이미지는 `accessibilityRole="none"`.
9. **다크모드 + 컬러 대비** — 다크 배경 + 다크 그레이 텍스트는 대비 부족. 화이트로 보강.
10. **VoiceOver 회전자 (Rotor)** — iOS는 두 손가락 회전으로 element 종류별 점프 (heading만 / link만). `accessibilityRole="header"` 박으면 그 화면의 헤딩만 점프 가능.

## 더 파볼 거리

- **WCAG 2.1 AA / AAA 기준** — 컬러 대비 / 폰트 크기 / 키보드 네비게이션
- **한국 정보접근성 인증** — 한국웹접근성평가센터 인증 기준 + 모바일 앱 인증
- **EU European Accessibility Act (EAA) 2025** — 디지털 제품 a11y 강제
- **자동 a11y 테스트** — `react-native-accessibility-engine`, `axe` RN port
- **`AccessibilityInfo` API** — 스크린리더 활성 감지, 동적 텍스트 안내 (`announceForAccessibility`)
- **Focus Management** — 화면 전환 시 첫 focus 위치 명시 (`accessibilityFocus`)
- **고대비 모드 + 시스템 설정 인지** — `useColorScheme` 외에 `useAccessibilityInfo` 활용
- **VoiceOver Custom Actions** — 한 element에 여러 동작 (`accessibilityActions`)
- **Reduced Motion** — `AccessibilityInfo.isReduceMotionEnabled()` — 애니메이션 줄이기

## 참고 링크

- [React Native Accessibility docs](https://reactnative.dev/docs/accessibility)
- [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Material Design Accessibility](https://m3.material.io/foundations/accessible-design/overview)
- [WCAG 2.1 가이드라인](https://www.w3.org/WAI/WCAG21/quickref/)
- [한국 모바일 정보접근성 가이드](https://www.kwacc.or.kr/Accessibility/MobileAccessibilityCertification)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
