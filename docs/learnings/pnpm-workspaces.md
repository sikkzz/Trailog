# pnpm Workspaces

> **작성일**: 2026-05-22
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라 / DevOps (1순위 — 모노레포 도구 기반)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md), [ADR-0001 모노레포 도구](../decisions/0001-monorepo-tool.md)

---

## 한 줄 요약

**pnpm workspaces** = 한 git 저장소 안의 여러 패키지(`apps/*`, `packages/*`)를 pnpm이 자동으로 묶어서, 서로를 로컬 의존성처럼 import하고 한 번의 `pnpm install`로 다 설치할 수 있게 해주는 기능.

## 우리 프로젝트에서 어디에 쓰이는가

- `pnpm-workspace.yaml` 한 줄로 "여기 모노레포다" 선언
- `apps/server` (NestJS) 와 `apps/mobile` (Expo) 가 `packages/shared-types` 의 DTO 타입을 `import { TripDto } from '@trailog/shared-types'` 처럼 가져다 쓸 예정
- `packages/eslint-config` 의 공통 ESLint 설정을 양쪽 앱이 `extends` 로 참조
- 루트에서 `pnpm install` 한 번이면 모든 워크스페이스의 의존성 일괄 설치
- Turborepo가 그 위에 얹혀서 빌드 캐싱·병렬 실행 담당 ([ADR-0001](../decisions/0001-monorepo-tool.md) 참고)

## 어떻게 동작하는가

### 핵심 메커니즘

```mermaid
flowchart LR
    Root["pnpm install (루트에서)"] --> Read[pnpm-workspace.yaml 읽음]
    Read --> Scan["apps/*, packages/* 의<br/>package.json 전부 스캔"]
    Scan --> Resolve{외부 의존성 vs<br/>워크스페이스 의존성}
    Resolve -->|외부 (예: express)| Store[".pnpm-store/ 글로벌 캐시<br/>(hard link)"]
    Resolve -->|워크스페이스 (예: @trailog/shared-types)| Link["node_modules 안에 symlink<br/>로컬 패키지로 연결"]
    Store --> Tree[각 패키지의 node_modules 구성]
    Link --> Tree
```

### 핵심 개념 4가지

**1. 워크스페이스 프로토콜 (`workspace:`)**

다른 워크스페이스 패키지에 의존할 땐 버전 대신 `workspace:` prefix를 씀:

```json
{
  "dependencies": {
    "@trailog/shared-types": "workspace:*"
  }
}
```

- `workspace:*` = "이 모노레포에 있는 같은 이름 아무 버전"
- `workspace:^` = "현재 버전과 호환되는 범위"
- 외부에 publish 할 때 pnpm이 자동으로 진짜 버전으로 치환

**2. 호이스팅 안 함 (npm/yarn과의 큰 차이)**

- npm/yarn workspaces는 모든 의존성을 **루트 node_modules로 끌어올림** (hoisting)
- 부작용: 패키지 A의 package.json엔 안 적혀 있는데 루트에 호이스팅된 게 우연히 import 되는 **유령 의존성 (phantom dependency)** 문제 발생
- pnpm은 각 패키지의 node_modules가 자기 의존성만 정확히 가짐 → **선언된 것만 import 가능**
- 처음엔 "왜 import 안 되지?" 하다가, 어디선가 빠뜨린 의존성 발견하는 경험을 곧 하게 될 예정

**3. Symlink + Content-Addressable Store**

- 외부 패키지 실물은 `~/.pnpm-store/` 한 곳에만 있음 (글로벌 캐시)
- 각 프로젝트의 `node_modules/.pnpm/` 안에 **hard link**로 연결
- 사용자 코드에서 보는 `node_modules/express` 는 그 hard link를 가리키는 **symlink**
- 결과: 디스크 절약 + 설치 속도 빠름 (같은 버전 한 번만 다운로드)

**4. `pnpm --filter` (필터링)**

특정 워크스페이스에만 명령 실행:

```bash
pnpm --filter @trailog/server dev      # server만 dev 실행
pnpm --filter "./apps/*" build         # apps 폴더 아래 전부 build
pnpm --filter @trailog/server... build # server + 그 의존성까지 빌드
```

- Turborepo의 `turbo run` 명령이 내부적으로 비슷한 일을 함

## 왜 다른 선택지가 아닌 이걸 골랐나

| 도구                      | 호이스팅           | 디스크 효율           | 유령 의존성  | 비고                          |
| ------------------------- | ------------------ | --------------------- | ------------ | ----------------------------- |
| **pnpm workspaces**       | ❌ (안 함, 좋음)   | ⭐⭐⭐ (글로벌 store) | ❌ 방지됨    | 우리 선택                     |
| npm workspaces            | ✅ (함)            | ⭐                    | ⚠️ 발생 가능 | 표준이지만 단점 명확          |
| yarn workspaces (classic) | ✅                 | ⭐⭐                  | ⚠️           | Berry 이후로 PnP 등 변화 큼   |
| lerna                     | (의존 도구에 따라) | (의존)                | (의존)       | 옛날 도구, 지금은 Nx에 흡수됨 |

PROJECT_ROOT에서 패키지 매니저를 pnpm으로 이미 확정한 이유와 같음: **빠르고 디스크 효율적이고 명시적인 의존성 관리**.

## 흔한 함정 / 주의할 점

1. **`workspace:*`를 IDE/도구가 못 알아들 때**: tsc, 일부 번들러가 가끔 헷갈림. 보통 `pnpm install` 한 번 더 돌리면 해결.
2. **`peerDependencies` 자동 설치 여부**: pnpm 8부터 `auto-install-peers=true`가 기본. 이전 버전 호환성 위해 `.npmrc` 에 명시해두면 안전.
3. **루트에 무심코 의존성 추가하기**: 루트 `package.json`은 `private: true`로 두고, 진짜 워크스페이스 공통 도구(turbo, prettier 같은)만 dev로. 앱 코드 의존성은 각 앱의 package.json에.
4. **빈 워크스페이스**: `apps/server`에 `package.json`이 없으면 pnpm이 워크스페이스로 인식 안 함. 빈 폴더는 무시됨.

## 더 파볼 거리 (선택)

지금은 안 다루지만 나중에 깊이 갈 만한 주제:

- **`.npmrc` 옵션들** — `link-workspace-packages`, `prefer-workspace-packages`, `shared-workspace-lockfile` 등
- **`pnpm patch`** — 외부 패키지를 fork 없이 임시 패치하는 방법
- **`pnpm deploy`** — 워크스페이스 패키지 하나를 독립적으로 빼서 배포용 디렉토리로 만들기 (Docker 빌드 시 유용)
- **`overrides`** — 의존성 트리 안의 특정 버전 강제 교체 (보안 패치 등)

## 참고 링크

- [pnpm Workspaces 공식 문서](https://pnpm.io/workspaces)
- [pnpm vs npm vs yarn 비교 (공식)](https://pnpm.io/feature-comparison)
- [Why pnpm? (motivation)](https://pnpm.io/motivation)
- 관련 ADR: [ADR-0001 모노레포 도구](../decisions/0001-monorepo-tool.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
