# ESLint v9 flat config + 워크스페이스 의존성 실전

> **작성일**: 2026-05-23
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라 / DevOps + 코드 품질
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md), [pnpm workspaces 노트](./pnpm-workspaces.md)

---

## 한 줄 요약

ESLint v9의 **flat config**는 `.eslintrc.json` 방식을 대체한 새 표준 설정 포맷. 동시에 우리는 ESLint 설정을 별도 워크스페이스 패키지(`@trailog/eslint-config`)로 분리하고 `workspace:*` 의존성으로 다른 워크스페이스에서 참조하는 모노레포 패턴을 처음 적용했다.

## 우리 프로젝트에서 어디에 쓰이는가

- `packages/eslint-config/` — 공유 ESLint 설정 (base + 환경별 nest)
- `apps/server/eslint.config.mjs` — `@trailog/eslint-config/nest` import 한 줄
- 향후 `apps/mobile/` 도 동일 패키지에서 `expo` export 추가해서 사용 예정
- 루트 `.prettierrc.json` — Prettier 설정은 단순해서 패키지 분리 안 함, 루트 한 곳에서 전 워크스페이스 적용

## 어떻게 동작하는가

### 1. Flat config — 왜 바뀌었나

ESLint v8까지는 `.eslintrc.json` 같은 **eslintrc** 포맷 사용:

```json
{
  "extends": ["eslint:recommended"],
  "plugins": ["@typescript-eslint"],
  "rules": { ... }
}
```

문제점:

- **암시적 머지 동작** — 부모 디렉토리의 `.eslintrc`가 자동 합쳐짐. 어디서 어떤 룰이 왔는지 추적 어려움
- **`extends`의 마법** — 문자열 이름으로 패키지를 찾아 자동 import. 명시성 부족
- **plugin namespace 충돌** — 두 플러그인이 같은 이름 룰을 정의하면 혼란

v9 flat config는 이걸 **JS 배열**로 명시화:

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      /* 명시적 추가 */
    },
  },
];
```

- 모든 설정이 **명시적 import**
- 배열 순서대로 머지 (뒤가 앞을 덮어씀)
- 자동 부모 lookup 없음 — `eslint.config.mjs`가 있는 디렉토리에서만 적용

### 2. flat config 배열 구조

각 원소는 다음 중 하나:

- **Config 객체**: `{ rules: {...}, languageOptions: {...} }`
- **`ignores` 전용 객체**: `{ ignores: ['dist/**'] }` — 다른 키 없으면 글로벌 ignore
- **다른 config의 배열**: spread로 펼침 (`...base`)

핵심 키:
| 키 | 역할 |
|----|-----|
| `files` | 이 config가 적용될 파일 패턴 (`['**/*.ts']`) |
| `ignores` | 무시할 파일 |
| `languageOptions` | parser, globals, ecmaVersion 등 |
| `plugins` | 플러그인 명시적 등록 (객체 형태) |
| `rules` | 룰 활성/끄기/옵션 |
| `linterOptions` | report 옵션 등 |

### 3. 우리 패키지 구조

```
packages/eslint-config/
├── package.json    # "exports" map으로 "/" + "/nest" 노출
├── base.js         # 모든 환경 공통 (recommended + TS + prettier compat)
└── nest.js         # base + Node globals + Nest 특화 완화
```

**`package.json`의 exports map**:

```json
"exports": {
  ".": "./base.js",
  "./nest": "./nest.js"
}
```

- `import x from '@trailog/eslint-config'` → `base.js`
- `import x from '@trailog/eslint-config/nest'` → `nest.js`
- `expo.js` 추가하면 `./expo` 한 줄로 노출

**`base.js` 의 구성 순서가 중요**:

```js
export default [
  js.configs.recommended,           // 1) JS 추천
  ...tseslint.configs.recommended,  // 2) TS 추천 (뒤가 1)을 일부 덮어씀)
  { rules: { ... } },               // 3) 프로젝트 룰
  { ignores: [...] },               // 4) 전역 ignore
  prettier,                          // 5) Prettier 충돌 룰 끄기 — 마지막!
];
```

`prettier`가 반드시 **마지막**이어야 하는 이유: 앞에서 켠 스타일 룰들을 그대로 두면 Prettier와 충돌. `eslint-config-prettier`는 충돌나는 룰을 모두 끄는 패치인데, 뒤에 있어야 앞 룰을 덮어씀.

### 4. Workspace 의존성 (`workspace:*`)

`apps/server/package.json`:

```json
"devDependencies": {
  "@trailog/eslint-config": "workspace:^"
}
```

- `workspace:*` = "이 모노레포의 같은 이름 패키지 아무 버전"
- `workspace:^` = pnpm이 자동 정규화한 형태 (현재 버전과 호환 범위)
- **pnpm install 시 실제 디스크 복사 X** — symlink로 `apps/server/node_modules/@trailog/eslint-config` → `packages/eslint-config/` 연결
- 그래서 `packages/eslint-config/base.js` 를 수정하면 server에서 **즉시 반영** (재install 불필요)

이 패턴이 모노레포의 핵심 가치 중 하나. 라이브러리를 npm publish 안 하고도 다른 워크스페이스가 즉시 쓸 수 있음.

### 5. ESLint 바이너리는 어디 있나 — pnpm의 비호이스팅과 충돌

pnpm은 의존성을 호이스팅 안 함. 즉:

- `packages/eslint-config`가 `eslint`를 deps로 가져도
- `apps/server`에서 `eslint` 바이너리를 직접 호출하려면 server가 직접 `eslint`를 install 해야 함

그래서 우리는 server에 `eslint`를 **별도 devDependency로 추가**함:

```json
"devDependencies": {
  "@trailog/eslint-config": "workspace:^",
  "eslint": "^9.0.0"
}
```

이건 pnpm의 "유령 의존성 방지" 정책의 직접적인 영향. 처음엔 번거롭지만, 의존성이 명시적이라 디버깅 쉬움.

## Prettier 충돌 회피 패턴

ESLint 와 Prettier 가 둘 다 코드 스타일을 다루면 충돌:

- ESLint: `semi` 룰로 세미콜론 강제
- Prettier: 자체 옵션으로 세미콜론 결정
- 둘이 다른 설정이면 ESLint가 fix → Prettier가 다시 fix → 무한 루프 가능

해결: **역할 분리** + `eslint-config-prettier`로 ESLint의 스타일 룰을 모두 끔.

- **Prettier**: 들여쓰기, 따옴표, 줄바꿈, trailing comma 등 (포맷팅)
- **ESLint**: unused var, no-explicit-any, no-console 등 (코드 품질)

## 흔한 함정 / 주의할 점

1. **flat config 파일 확장자** — `eslint.config.js` 는 `package.json`의 `"type"` 에 따라 ESM/CJS 분기. 헷갈리니까 명시적으로 `eslint.config.mjs` 추천.
2. **`tseslint.configs.recommended` 는 배열** — `...` 스프레드 필요. 객체로 다루면 룰이 안 먹음.
3. **`prettier`를 앞에 두는 실수** — Prettier 충돌 룰이 다시 켜짐. 반드시 마지막.
4. **`--ignore-path .gitignore`** (Prettier 3 이전) — Prettier 3+는 기본적으로 `.gitignore`와 `.prettierignore` 둘 다 자동 인식. `--ignore-path` 옵션은 빼는 게 깔끔.
5. **workspace deps 변경 시 재install 필요 여부** — symlink라 코드 변경은 즉시 반영. 단 패키지의 `exports` map이나 `package.json` 변경 시는 `pnpm install` 다시.

## 검증 결과 (이번 셋업에서)

테스트 코드로 위반 케이스 확인:

```typescript
const unused = 1; // ❌ @typescript-eslint/no-unused-vars
const bad: any = '...'; // ❌ @typescript-eslint/no-explicit-any
console.log(bad); // ⚠️ no-console (allow: warn/error/info)
```

→ ESLint가 정확히 잡음. Exit status 1 → CI에서 PR 막을 수 있음.

## 더 파볼 거리 (선택)

- **typescript-eslint의 `strictTypeChecked` / `stylisticTypeChecked` 추가** — 타입 정보 기반 강화 룰 (Phase 2 즈음)
- **CI에서 변경된 파일만 lint** — turbo + `--filter=...[origin/main]` 조합
- **husky + lint-staged** — 커밋 전 자동 lint/format (Phase 1 4.2 Q4 해당)
- **ESLint 룰 customization** — 프로젝트 컨벤션 굳어지면 자체 룰 추가
- **Expo/RN용 ESLint 설정** — `eslint-config-expo`, React Native 룰셋 (mobile 셋업 시)

## 참고 링크

- [ESLint flat config 공식](https://eslint.org/docs/latest/use/configure/configuration-files)
- [typescript-eslint v8 마이그레이션](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8)
- [eslint-config-prettier 동작 원리](https://github.com/prettier/eslint-config-prettier#installation)
- [pnpm workspace protocol](https://pnpm.io/workspaces#workspace-protocol-workspace)
- 관련 코드: `packages/eslint-config/`, `apps/server/eslint.config.mjs`

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
