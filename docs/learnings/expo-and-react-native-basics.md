# Expo + React Native 기초 (모노레포 셋업 경험 포함)

> **작성일**: 2026-05-24
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 모바일 네이티브 + 앱 배포 (학습 영역 #6 시작)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md), [pnpm workspaces 노트](./pnpm-workspaces.md), [NestJS 부트스트랩](./nestjs-bootstrapping.md)

---

## 한 줄 요약

**Expo** = React Native를 더 쉽게 만든 프레임워크 + 도구 모음. **Expo Router**는 파일 기반 라우팅(`src/app/` 폴더가 곧 라우트). **Metro**는 RN 전용 번들러. **시뮬레이터/에뮬레이터/Expo Go/Dev Build** 네 가지가 RN 개발 실행 환경의 주요 옵션이고 각자 트레이드오프가 있다.

## 우리 프로젝트에서 어디에 쓰이는가

- `apps/mobile/` — React Native + Expo SDK 56 + Expo Router
- `apps/mobile/src/app/` — Expo Router의 파일 기반 라우트
- `apps/mobile/metro.config.js` — pnpm 모노레포 + Expo 호환을 위한 Metro 설정
- 루트 `.npmrc` — `node-linker=hoisted` (Expo 호환성)
- `packages/eslint-config/expo.js` — RN/Expo용 ESLint 룰 (React + Hooks + browser/node globals)

## Expo Managed vs Bare React Native (왜 Expo인가)

| 항목               | Expo Managed (우리)    | Bare React Native                      |
| ------------------ | ---------------------- | -------------------------------------- |
| 시작 명령          | `npx create-expo-app`  | `npx @react-native-community/cli init` |
| 네이티브 코드 접근 | ❌ (`prebuild` 전까지) | ✅ ios/, android/ 폴더 직접            |
| 셋업 부담          | 낮음                   | 높음 (Xcode/Android Studio 풀세트)     |
| Expo Go 사용 가능  | ✅                     | ❌                                     |
| EAS Build 사용     | ✅                     | ✅ (선택)                              |
| OTA 업데이트       | ✅ EAS Update          | 별도 셋업                              |
| 시장 점유 (2026)   | **사실상 표준**        | 토스/당근 같은 대형 RN 기업            |

**왜 Expo Managed**:

- 2026년 RN 표준 (Meta 공식 권장)
- 셋업 부담 ↓ → 본진(이미지/지도/카메라) 시간 ↑
- EAS Build로 production 빌드도 깔끔
- 필요 시 `expo prebuild`로 Bare 전환 가능 (탈출구 있음)

## 핵심 개념 6가지

### 1. Expo Router — 파일 기반 라우팅

Next.js App Router와 같은 패턴.

```
src/app/
├── _layout.tsx       # 루트 레이아웃 (모든 화면이 이 안에서 도는)
├── index.tsx         # "/" 경로
├── settings.tsx      # "/settings" 경로
├── trips/
│   ├── _layout.tsx   # trips 그룹 레이아웃
│   ├── index.tsx     # "/trips"
│   └── [id].tsx      # "/trips/123" (동적 경로)
└── (tabs)/           # 그룹 (URL에 안 나타남)
    ├── _layout.tsx   # 탭 네비게이션
    ├── home.tsx
    └── profile.tsx
```

- **`_layout.tsx`** = 그 폴더의 모든 라우트가 공유하는 wrapper. Stack, Tabs, Drawer 등 네비게이션 결정
- **`[id].tsx`** = 동적 경로. `useLocalSearchParams()`로 id 받기
- **`(group)`** = 라우트 그룹화만, URL엔 안 들어감 (탭 같은 거 묶을 때)

설정 (`app.json`):

```json
{
  "expo": {
    "plugins": ["expo-router"],
    "experiments": { "typedRoutes": true }
  }
}
```

`typedRoutes: true`면 경로 typesafe (잘못된 경로 push 시 TS 에러).

### 2. Metro Bundler — RN의 webpack

웹의 webpack/vite 역할을 RN에서 함:

- JS/TS/JSX 변환 (Babel 통해)
- 모듈 해석 (`import` 경로 찾기)
- HMR (Hot Module Replacement)
- 번들 → 시뮬레이터/에뮬레이터로 전송

**우리 metro.config.js의 핵심 — 모노레포 트릭**:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot]; // 워크스페이스 변경 감지
config.resolver.nodeModulesPaths = [
  // 패키지 lookup 순서
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false; // hoisted 모드 호환

module.exports = config;
```

### 3. 시뮬레이터 / 에뮬레이터 / Expo Go / Dev Build (실행 환경 4가지)

| 옵션                         | 무엇                                              | 장점                       | 단점                                   |
| ---------------------------- | ------------------------------------------------- | -------------------------- | -------------------------------------- |
| **iOS 시뮬레이터**           | Mac 안의 가상 iPhone (Xcode 제공)                 | 빠름, 디버깅 강력          | Xcode 풀 설치 필요 (10GB+)             |
| **Android 에뮬레이터 (AVD)** | Mac 안의 가상 Pixel (Android Studio 제공)         | 다양한 기종/API 시뮬레이션 | 무거움, 부팅 느림                      |
| **Expo Go**                  | 폰에 설치된 미리 만든 컨테이너 앱. JS만 받아 실행 | 셋업 0, 즉시 실행          | 일부 네이티브 모듈 한계 (카메라·BT 등) |
| **Development Build**        | EAS로 빌드한 본인 폰 전용 앱                      | 모든 네이티브 모듈 OK      | 빌드 시간 (EAS 5~15분)                 |

**우리가 검증한 것**: iOS 시뮬레이터(iPhone) + Android 에뮬레이터(Pixel 9) 양쪽. 같은 Metro에서 동시 가능.

**향후 흐름** (Phase 1 4.5):

- Expo Go 또는 Dev Build로 본인 폰에 직접 설치
- 실제 카메라/위치/푸시 검증

### 4. app.json — Expo 메타 파일

```json
{
  "expo": {
    "name": "Trailog",                  # 앱 이름 (시뮬레이터에 표시)
    "slug": "trailog",                  # URL friendly 식별자
    "version": "0.0.1",                 # 마케팅 버전
    "scheme": "trailog",                # 딥링크 스킴 (trailog://)
    "newArchEnabled": true,             # RN New Architecture (Fabric + TurboModules)
    "ios": {
      "bundleIdentifier": "com.trailog.app",
      "supportsTablet": true
    },
    "android": {
      "package": "com.trailog.app",
      "edgeToEdgeEnabled": true         # Android 15+ 풀스크린
    },
    "plugins": ["expo-router"],
    "experiments": { "typedRoutes": true }
  }
}
```

향후 추가될 항목:

- `icon`, `splash` (Phase 4쯤)
- `permissions` (카메라, 위치 등)
- `extra` (환경별 설정값)

### 5. babel.config.js — JS/TS 변환

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

Expo가 알아서 적절한 preset 묶음 제공. `react-native`, `typescript`, JSX 등.

### 6. Hot Reload — 코드 수정 즉시 반영

Metro 떠 있는 동안:

- 코드 저장 → Metro가 변경 감지 → 시뮬레이터에 즉시 반영 (1초 이내)
- **Fast Refresh** = React 컴포넌트 state 보존하며 reload (가장 부드러움)
- 키보드 단축키 (Metro 터미널에서):
  - `r` = 전체 리로드
  - `i` = iOS 시뮬레이터 열기
  - `a` = Android 에뮬레이터 열기
  - `w` = 웹 브라우저
  - `j` = 디버그 메뉴

## 우리가 만난 에러 — 학습 가치 큼

### 에러 1: `Unable to resolve "@expo/log-box/src/LogBox"`

**증상**: iOS 빌드 시 Metro가 transitive 의존성 못 찾음

```
@expo/metro-runtime → @expo/log-box (못 찾음)
```

**원인**: **pnpm의 비호이스팅 정책 ↔ Expo의 transitive import 패턴 충돌**.

- pnpm 기본: 의존성을 `.pnpm/` 안에 격리 (유령 의존성 방지)
- Expo: transitive deps도 자유롭게 require 가정

**해결**: 루트 `.npmrc`에 `node-linker=hoisted` 추가 + clean install.

- pnpm을 npm/yarn처럼 hoisting 모드로 동작
- 모든 의존성이 루트 `node_modules`에 평평하게 → Metro가 표준 lookup 가능
- 단 [pnpm 학습 노트](./pnpm-workspaces.md)의 "유령 의존성 방지" 효과는 잃음
- Expo 공식 monorepo 가이드의 권장 설정

추가로 `metro.config.js`의 `disableHierarchicalLookup`도 `false`로 변경 (hierarchical lookup 허용).

### 에러 2: Incompatible React versions

**증상**:

```
react: 19.2.6
react-native-renderer: 19.2.3
must have the exact same version
```

**원인**: 우리가 `pnpm add react`로 latest 받았는데 Expo SDK 56이 요구하는 정확한 버전과 다름.

**해결**: `npx expo install --check` 로 호환 버전 확인 → pnpm으로 정확한 버전 install.

**핵심 교훈**:

- **Expo 환경에선 `npx expo install` 이 패키지 매니저 명령보다 안전** (호환 버전 자동 매칭)
- 우리처럼 pnpm 쓰는 경우 `expo install --check` 로 확인만 하고 실제 설치는 pnpm으로
- React Native의 React/React Native/React-DOM은 **exact match 필요** (메이저 X, 마이너 X, 패치까지)

## 흔한 함정 / 주의할 점

1. **`expo install` 무심코 실행** — npm/yarn 호출해서 lockfile 깨질 수 있음. pnpm 환경에선 `--check`로 확인만, 설치는 pnpm.
2. **React 버전 직접 add 금지** — `pnpm add react@latest` 하면 Expo SDK와 호환 깨짐. `npx expo install --check` 먼저.
3. **`node-linker=hoisted` 의 부작용** — pnpm의 유령 의존성 방지 효과 잃음. server는 그대로 비호이스팅 OK인데 워크스페이스별 다르게 설정 어려움. 이번은 Expo 호환 우선.
4. **첫 빌드는 인내심** — iOS CocoaPods install + Android Gradle download 첫 실행은 5~10분. 이후엔 1분 이내.
5. **Metro 캐시 이슈** — 에러 해결 후에도 옛 캐시 때문에 에러 지속. `expo start --clear` 또는 `r` 키로 풀 리로드.
6. **JSX 반환 타입 명시** (React 19) — `JSX.Element` 네임스페이스가 `React.JSX`로 옮겨짐. 명시 안 하거나 `React.JSX.Element` 사용.
7. **Node.js 버전 권고** — Expo SDK 56은 Node 20.19.4+ 권장. 마이너 업그레이드 필요 (nvm 활용).

## 우리 셋업 변수 정리

| 변수               | 우리 값                                       |
| ------------------ | --------------------------------------------- |
| Expo SDK           | 56                                            |
| React              | 19.2.3 (exact)                                |
| React Native       | 0.85                                          |
| Expo Router        | 56.2                                          |
| 모노레포 도구      | pnpm + Turborepo                              |
| 패키지 매니저 모드 | `node-linker=hoisted` (Expo 호환)             |
| TypeScript         | ~6.0.3 (mobile만, server는 5.x)               |
| 라우터             | Expo Router (파일 기반)                       |
| 상태관리           | (Phase 2부터 Zustand 또는 RTK + React Query)  |
| 지도               | (Phase 3부터 react-native-maps 또는 MapLibre) |

## 더 파볼 거리 (선택)

- **Expo Router 그룹/모달/탭** — `(group)`, `(modal)`, `(tabs)` 패턴
- **EAS Build** — 클라우드 빌드 + 본인 폰 설치 + 스토어 제출 (Phase 1 4.5)
- **EAS Update** — OTA 업데이트 (앱스토어 심사 없이 JS 변경 push)
- **React Native New Architecture** — Fabric (renderer) + TurboModules (native modules) + JSI
- **expo-image / expo-camera / expo-location** — 우리 도메인에 곧 쓸 모듈 (Phase 2)
- **Hermes vs JSC** — JS 엔진 선택 (Expo 56은 Hermes 기본)
- **Reanimated + Gesture Handler** — 부드러운 애니메이션
- **React Native Debugger / Flipper** — 디버깅 도구

## 참고 링크

- [Expo 공식 docs](https://docs.expo.dev/)
- [Expo Router 공식](https://docs.expo.dev/router/introduction/)
- [Expo Monorepo 가이드](https://docs.expo.dev/guides/monorepos/) — 우리 .npmrc + metro.config 의 근거
- [React Native 공식](https://reactnative.dev/)
- [Expo SDK 56 changelog](https://expo.dev/changelog) — 최신 변경 사항
- 관련 노트: [pnpm Workspaces](./pnpm-workspaces.md), [ESLint flat config + workspace](./eslint-flat-config-and-workspace-deps.md)
- 관련 코드: `apps/mobile/`, `packages/eslint-config/expo.js`, `.npmrc`

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
