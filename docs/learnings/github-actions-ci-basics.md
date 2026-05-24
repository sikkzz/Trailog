# GitHub Actions CI 기초 (모노레포 + pnpm + Turborepo)

> **작성일**: 2026-05-24
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라 / DevOps (1순위 — CI/CD 첫 본격 경험)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md), [pnpm workspaces](./pnpm-workspaces.md), [ADR-0001 Turborepo](../decisions/0001-monorepo-tool.md)

---

## 한 줄 요약

**GitHub Actions** = GitHub에 내장된 CI/CD 도구. `.github/workflows/*.yml` 한 파일에 자동화 시나리오를 선언하면, **PR/푸시/스케줄 등 이벤트에 반응해서 클라우드 VM(runner)에서 자동 실행**. 우리는 매 PR마다 lint/typecheck/build를 자동 검증해서 main 브랜치 품질을 지킴.

## 우리 프로젝트에서 어디에 쓰이는가

- `.github/workflows/ci.yml` — PR 및 main 푸시 시 자동 검증
- Phase 4 진입 시 추가 워크플로 예정:
  - 백엔드 Docker 이미지 빌드 + ECR push + ECS 배포 (또는 PaaS)
  - 모바일 EAS Build 트리거
  - Sentry release 등록

## 핵심 개념 5가지

### 1. workflow / job / step / action — 계층 구조

```
.github/workflows/
└── ci.yml                            # 하나의 workflow

workflow (자동화 시나리오 1개)
└── jobs (병렬로 실행 가능)
    ├── job "ci" (한 runner = 한 VM)
    │   └── steps (순차 실행)
    │       ├── step 1: actions/checkout@v4   # 코드 받기
    │       ├── step 2: pnpm/action-setup@v4   # pnpm 설치
    │       ├── step 3: actions/setup-node@v4  # Node + 캐시
    │       └── step 4~: run: pnpm lint        # 실제 명령
    └── (다른 job 가능, 병렬 또는 의존)
```

- **workflow**: 한 YAML 파일 = 한 자동화 시나리오. `on:` 으로 트리거 정의.
- **job**: 한 runner(VM)에서 도는 단계 묶음. `runs-on:` 으로 OS 지정.
- **step**: job 안의 단일 동작. `uses:` (action 호출) 또는 `run:` (셸 명령).
- **action**: 재사용 가능한 코드 블록. 마켓플레이스에서 가져다 씀 (`actions/checkout`, `pnpm/action-setup` 등).
- **runner**: workflow 실행 환경. `ubuntu-latest` / `macos-latest` / `windows-latest`. 무료 티어 풍부 (월 2000분 기준).

### 2. 트리거 (`on:` 필드) — 언제 도는가

흔한 트리거:

```yaml
on:
  pull_request: # PR 생성/업데이트 시
    branches: [main]
  push: # 직접 push 시
    branches: [main]
  schedule: # cron으로 주기적
    - cron: '0 0 * * *' # 매일 자정 (UTC)
  workflow_dispatch: # 수동 실행 (Actions 탭에서 "Run workflow" 버튼)
```

우리는 `pull_request` + `push: main` 조합:

- **PR 시 검증**: main에 머지되기 전에 lint/typecheck/build 확인
- **main 푸시 시 재검증**: 머지 후 main 자체도 한 번 더 (병합 충돌 회피)

### 3. `actions/checkout`, `actions/setup-node`, `pnpm/action-setup` — 표준 세트

거의 모든 Node 프로젝트의 CI 시작 3종 세트:

| Action                      | 역할                                                              |
| --------------------------- | ----------------------------------------------------------------- |
| **`actions/checkout@v4`**   | git repo를 runner에 체크아웃. 거의 모든 워크플로 첫 step          |
| **`pnpm/action-setup@v4`**  | pnpm CLI 설치. `package.json`의 `packageManager` 필드를 자동 인식 |
| **`actions/setup-node@v4`** | Node.js 설치 + 패키지 매니저 캐시                                 |

순서가 중요:

- `setup-node`의 `cache: 'pnpm'`이 동작하려면 **pnpm이 먼저 설치되어 있어야** (pnpm-action-setup 먼저)
- checkout이 가장 먼저 (당연)

### 4. 캐시 — CI 속도의 핵심

CI는 매 실행마다 깨끗한 VM에서 시작. 그래서 `node_modules`를 매번 다시 install하면 느림.

**우리 캐시 전략 2단계**:

```yaml
# 1) pnpm-store 캐시 (의존성 다운로드 결과)
- uses: actions/setup-node@v4
  with:
    node-version-file: '.nvmrc'
    cache: 'pnpm' # ← pnpm-lock.yaml 해시 기반 캐시

# 2) Turborepo 캐시 (빌드/lint/typecheck 결과)
- uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ github.sha }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

- **pnpm cache**: lockfile 변경 없으면 의존성 다운로드 건너뜀 (1분 → 10초)
- **turbo cache**: 변경되지 않은 워크스페이스의 lint/build 결과 재사용 (10초 → 0초)

`key`와 `restore-keys` 패턴:

- `key`: 완전 일치 시 그대로 사용
- `restore-keys`: 부분 일치(prefix) — 캐시 없을 때 가장 가까운 옛 캐시 가져옴 → 점진적 빌드

### 5. concurrency — 중복 실행 자동 취소

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- **시나리오**: PR에 push가 5번 연속 들어옴 → CI 5번 동시에 도는 낭비
- **해결**: 같은 그룹(workflow + ref)의 새 실행이 들어오면 이전 실행 자동 취소
- 효과: CI 분(=비용/시간) 절약. 무료 티어 한정에서 중요.

## 우리 ci.yml 분석

```yaml
name: CI

on:
  pull_request: { branches: [main] }
  push: { branches: [main] }

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Lint + Typecheck + Build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4 # packageManager 자동 인식
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc' # 로컬과 동일 Node 버전
          cache: 'pnpm'
      - uses: actions/cache@v4 # turbo cache
        with:
          path: .turbo
          key: ${{ runner.os }}-turbo-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-turbo-
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
```

**왜 단계 분리 (lint/typecheck/build 각각)**:

- 실패 시 어느 단계가 막혔는지 GitHub Actions UI에서 명확
- (사이드 규모엔 큰 차이 X지만 좋은 습관)

**`--frozen-lockfile`**: lockfile 변경 시도 즉시 실패. CI에선 항상 사용 (lockfile 무결성 검증).

## CI에서 자주 만나는 함정

1. **로컬은 되는데 CI에서 안 됨** — 보통 lockfile 깨졌거나 환경변수 누락. `--frozen-lockfile`로 lockfile 변경 사전 차단.
2. **캐시 stale로 옛 동작** — `key` 변경하거나 GitHub Actions 캐시 수동 삭제 (Settings → Actions → Caches).
3. **node_modules는 캐시하지 말 것** — symlink 깨짐. pnpm-store만 캐시.
4. **secrets는 echo 금지** — CI 로그에 노출. GitHub Actions가 자동 마스킹하지만 안전상 노출 X.
5. **`run` 명령에서 변수 치환** — `${{ }}` 는 GitHub Actions 컨텍스트, `$VAR`는 셸. 헷갈리지 말기.
6. **runner 시간대(UTC)** — `Asia/Seoul` 가정 X. cron 등 시간 관련 작업은 변환 필요.
7. **monorepo lint 시 모든 패키지 매번 lint** — `turbo run lint` 가 캐시 활용해 변경된 것만 처리 (우리 셋업).

## 자주 쓰는 패턴 (앞으로 추가될 것들)

| 패턴                                                                 | 언제 추가                      |
| -------------------------------------------------------------------- | ------------------------------ |
| **PR 변경 파일만 lint** (`turbo run lint --filter=...[origin/main]`) | Phase 1 후반                   |
| **테스트 자동 실행**                                                 | Phase 2 (test 셋업 후)         |
| **Docker 이미지 빌드**                                               | Phase 4 (AWS ECS 마이그레이션) |
| **EAS Build 트리거**                                                 | Phase 1 4.5                    |
| **Sentry release 등록**                                              | Phase 4 (Sentry 도입 후)       |
| **Slack/Discord 알림**                                               | 본인 필요 시                   |
| **PR comment로 빌드 결과**                                           | turbo summary 활용             |

## CI 보안 기본

실무에서 자주 만나는 보안 패턴:

- **`secrets.GITHUB_TOKEN`** — GitHub이 자동 발급하는 토큰. repo 권한.
- **Repository Secrets** — 개인 토큰/API key. Settings → Secrets and variables.
- **Environment Secrets** — 환경별(dev/staging/prod) 시크릿 분리 + approval 요건.
- **OIDC 토큰** — AWS/GCP에 시크릿 없이 인증 (Phase 4에 본격 학습).
- **fork PR의 secret 차단** — 외부 PR은 default로 secret 접근 못함 (악의적 PR 방지).

## husky + 4계층 안전망 — CI의 짝궁

CI(클라우드)만으로는 부족한 경우가 있음:

- **CI는 push/PR 시점에야 도는 사후 검증**. 로컬에서 commit 실수해도 잡히는 건 5초~몇 분 뒤.
- **무료 분 제약** (private repo 월 2,000분). CI 자주 돌수록 비용 위험.
- **PR 외 직접 push에서 우회 가능** (브랜치 보호 규칙 없을 때).

→ **husky로 로컬 사전 검증 + CI 최종 검증** 조합 = 4계층 안전망:

```
Layer 1: husky pre-commit       → lint-staged (변경 파일만, ~3초)
Layer 2: husky commit-msg       → commitlint  (메시지 형식, ~1초)
Layer 3: husky pre-push         → typecheck   (~5초)
Layer 4: GitHub Actions CI      → lint + typecheck + build (~1분)
```

### 도구 3종 역할

| 도구            | 역할                                               |
| --------------- | -------------------------------------------------- |
| **husky**       | git hook 관리 (`.husky/` 디렉토리에 sh 스크립트)   |
| **lint-staged** | staged 파일만 lint/format (전체 X)                 |
| **commitlint**  | commit 메시지가 Conventional Commits 형식인지 검증 |

### 우리 셋업

`package.json` 루트:

```json
{
  "scripts": { "prepare": "husky" },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml,yml}": ["prettier --write"]
  }
}
```

`commitlint.config.js`:

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [0], // 한글 메시지 허용
    'header-max-length': [2, 'always', 100],
  },
};
```

`.husky/pre-commit`:

```sh
npx lint-staged
```

`.husky/commit-msg`:

```sh
npx --no -- commitlint --edit "$1"
```

`.husky/pre-push`:

```sh
pnpm typecheck
```

### `prepare` 스크립트가 핵심

```json
"scripts": { "prepare": "husky" }
```

- npm/pnpm install 시 자동 실행되는 npm 표준 lifecycle script
- husky가 `.git/hooks/` 에 hook을 자동 등록
- → **clone 후 install만 하면 husky 자동 활성**. 신규 컨트리뷰터 친화.

### 우회 시 — `--no-verify`

긴급 시 hook 우회 가능:

```bash
git commit --no-verify -m "긴급 패치"
git push --no-verify
```

단 CI(Layer 4)는 우회 불가 → main에 깨진 코드 가는 거 방지. 이게 husky만 운용할 때와의 차이.

### husky 한계 (CI가 보완)

- 로컬 hook은 본인 머신에서만 동작. **다른 협업자가 안 깔았으면 무의미**.
- `--no-verify`로 우회 가능 → 강제력 ↓.
- 로컬 셋업이 다르면 결과도 다를 수 있음 (Node 버전 등).
- → **이래서 CI 필요**. 클라우드의 통제된 환경에서 최종 검증.

## 실무 환경과의 비교

- 실무도 `.github/workflows/` 사용 (확인됨)
- 실무는 npm 사용 → workflow에서 `npm install` 호출 (우리는 pnpm)
- 실무는 빌드 후 ECR push → ECS 업데이트 흐름 (Phase 4에 우리도 비슷한 흐름 학습 예정)
- 본인이 참조 코드 베이스에서 `.github/workflows/ci.yml`을 읽으면 우리 구조와 비슷해서 빠르게 이해 가능

## 더 파볼 거리 (선택)

- **Reusable Workflows** — 여러 repo에서 공통 workflow 재사용
- **Composite Actions** — 여러 step을 묶어 사용자 정의 action
- **Matrix 빌드** — Node 18/20/22, Linux/Mac 등 여러 환경에서 동시 검증
- **`needs:` 의존성** — job 순서 제어 (예: build → deploy)
- **Self-hosted Runner** — 본인 머신에서 CI 실행 (private/특수 환경)
- **Actions Marketplace** — 수많은 재사용 action 검색
- **`workflow_call`** — 워크플로 간 호출
- **GitHub Actions 비용 측정** — 무료 티어 모니터링 (Settings → Billing)

## 참고 링크

- [GitHub Actions 공식](https://docs.github.com/actions)
- [actions/setup-node 공식](https://github.com/actions/setup-node)
- [pnpm/action-setup 공식](https://github.com/pnpm/action-setup)
- [actions/cache 공식](https://github.com/actions/cache)
- [Turborepo CI 가이드](https://turborepo.com/docs/guides/ci-vendors/github-actions)
- 관련 코드: `.github/workflows/ci.yml`

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
