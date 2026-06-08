# ADR-0011: 모바일 디자인 시스템 — NativeWind v4

> **상태**: Accepted
> **날짜**: 2026-06-08
> **결정자**: @sikkzz (with Claude)
> **관련 문서**: [Phase 2 Spec 4.8](../specs/phase-02-core-features.md), 학습 노트(예정) `mobile-design-system-comparison.md`

---

## 맥락 (Context)

Phase 2 4.8 UI/UX 폴리시 wave 진입. 4.6/4.7 진행 중 모든 화면이 **각자 hardcode StyleSheet**으로 색상/spacing/typography 정의 — 일관성 X + 다크모드 X + 디자이너 없는 1인 사이드에서 폴리시 wave마다 모든 화면 수동 정정 부담. **디자인 시스템 lib 도입**으로 토큰 단일 출처 + 다크모드 + 참조 패턴 정복.

## 결정 (Decision)

**선택**: **NativeWind v4.2.5** (Tailwind for React Native).

`className` prop 패턴 + `dark:` prefix 자체 다크모드 + 참조 Web Tailwind 친숙도 transfer + Expo SDK 56 + New Architecture 호환.

## 이유 / 트레이드오프

**이 선택으로 얻는 것**:

- **참조 Tailwind 친숙도 정복 + transfer 학습** — 참조 Web에서 Tailwind 사용 중. Mobile에서도 같은 패턴 → Web↔Mobile 학습 transfer ↑
- **`className` API** — 기존 `StyleSheet` 마이그레이션을 화면별로 점진 가능 (한 번에 다 갈아엎기 X)
- **다크모드 표준 지원** — `dark:` prefix만으로 light/dark 자동 분기. `useColorScheme()` 시스템 자동
- **Pretendard 적용 자연** — `font-pretendard` className. fontFamily 토큰화
- **참조 코드 비교 모드 일관** — 4.6/4.7에서 참조 패턴(Tailwind+Radix+shadcn) 비교 박제했음. NativeWind 채택은 일관성 ↑

**이 선택으로 포기하는 것**:

- **Tamagui의 자체 컴포넌트 + theme 깊이 정복 보류** — 의도적 다양화 학습 가치 ↑이지만 1주 호흡 부담 + 참조 패턴 친숙 우선
- **`react-native-reanimated` 추가 native module** — dev build 재빌드 필수 (1회). 단 향후 Reanimated 3 애니메이션 학습에도 쓰일 자산
- **Tailwind class 길어지면 가독성 ↓** — `text-base font-medium text-text-primary dark:text-white px-4 py-3 ...` 식. JSX 줄 길이 관리 필요
- **RN Tailwind는 일부 web 한계** — hover/container 등 web 전용 utility X. mobile native에만 적용

**학습 가치 관점**:

- **참조 코드 깊이 정복 전략** — 사이드 Tailwind 정복은 Web↔Mobile 양방향 활용 (참조 Web 코드 작성 시 mobile 경험 transfer)
- **추후 NativeWind → 다른 lib 마이그레이션 시점** — Tamagui, Restyle 등 깊이 정복 가능 (메모리 박제 가치)
- **참조 코드 비교 모드 강화** — Trailog mobile UI 작성 시 참조 Web Tailwind 클래스 ↔ mobile NativeWind 차이 박제 (4컬럼 비교 패턴)

## 검토한 대안

| 대안                              | 장점                                                                      | 단점                                                      | 제외 이유                                     |
| --------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------- |
| **NativeWind v4**                 | 참조 Tailwind 친숙 / className 자연 / 다크모드 prefix / 점진 마이그레이션 | reanimated native 추가 / class 길이 가독성 / RN 한계 일부 | ✅ 채택                                       |
| Tamagui                           | 자체 컴포넌트 + theme 풍부 / 컴파일 타임 최적화 / 성능 ↑                  | 학습 곡선 ↑ / 참조 패턴 X / 1주 호흡 부담                 | 의도적 다양화 가치 ↑이지만 참조 transfer 우선 |
| Restyle (Shopify)                 | TypeScript theme 안정 / StyleSheet 기반 단순                              | theme switch 수동 / className 없음                        | 안정성 OK but 참조 패턴 X + Tailwind 친숙도 ↓ |
| 자체 theme + Context + StyleSheet | 직접 구현 / 학습 가치 ↑                                                   | ROI ↓ / 일관성 강제 X / 다크모드 직접 구현                | 1주 호흡엔 over                               |
| StyleSheet 그대로 유지            | 의존성 0                                                                  | 일관성 X / 다크모드 직접 / 폴리시 wave마다 수동           | 폴리시 wave 목적과 충돌                       |

## 결과 / 영향

### 의존성 추가

```bash
pnpm --filter @trailog/mobile exec expo install nativewind react-native-reanimated react-native-safe-area-context
pnpm --filter @trailog/mobile add -D tailwindcss@^3.4.17 prettier-plugin-tailwindcss
```

(`react-native-safe-area-context`는 이미 4.6에서 설치됨 — skip)

### 새 설정 파일

- `apps/mobile/tailwind.config.js` — Tailwind 토큰 (색상/typography/spacing/radius)
- `apps/mobile/global.css` — Tailwind directives
- `apps/mobile/babel.config.js` — `nativewind/babel` plugin 추가
- `apps/mobile/metro.config.js` — `withNativewind` wrapper
- `apps/mobile/nativewind-env.d.ts` — TypeScript className 지원

### 구조 변경

- 디자인 토큰 단일 출처 — `tailwind.config.js`의 `theme.extend`
- 다크모드 — `dark:` prefix + `useColorScheme()` 시스템 자동
- 기존 화면 마이그레이션 — `StyleSheet.create` + `style={styles.x}` → `className="..."` 점진

### 향후 작업 (D2~D3)

- **D2-2** Pretendard 폰트 — `expo-font` + `fontFamily` 토큰화
- **D2-3** 디자인 토큰 정의 — light + dark 둘 다 정의 (Modern Minimal + Earthy Brown)
- **D2-4** Theme Provider + `useColorScheme()` 시스템 자동
- **D3** 기존 화면(login/signup/moments/photos/map) 마이그레이션

## 재검토 트리거

1. **Tailwind class 길어져 가독성 ↓ 명확 시점** — `cva`/`clsx`/`tailwind-variants` 같은 wrapper 도입 검토
2. **Reanimated worklet animation 본격 진입 시 (Phase 후속)** — NativeWind와 호환성 검증 (v4는 reanimated 활용해 atomic class 최적화)
3. **NativeWind 유지보수 정체 시** — Tamagui 또는 Restyle 마이그레이션 검토
4. **다른 도메인 모듈 추가 (서비스 4+) — 디자인 시스템 깊이 정복 wave 진입 시** — Tamagui/Restyle 병행 또는 자체 시스템

## 참고

- [NativeWind v4 docs](https://www.nativewind.dev/)
- [Expo + NativeWind 가이드](https://docs.expo.dev/versions/latest/sdk/) (공식 통합)
- [Tailwind CSS](https://tailwindcss.com/)
- [Pretendard 폰트](https://github.com/orioncactus/pretendard)
- [Tamagui (비교 대안)](https://tamagui.dev/)
- [Restyle (비교 대안)](https://github.com/Shopify/restyle)
