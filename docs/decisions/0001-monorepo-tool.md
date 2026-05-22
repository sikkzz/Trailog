# ADR-0001: 모노레포 빌드 도구 선택

> **상태**: ✅ Accepted (확정 2026-05-22)
> **날짜**: 2026-05-22
> **결정자**: @sikkzz (제안: Claude)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md)

---

## 맥락 (Context)

Phase 1에서 pnpm 모노레포로 `apps/mobile`(Expo) + `apps/server`(NestJS) + `packages/*`(shared-types, eslint-config 등)을 묶는다. 패키지 매니저는 PROJECT_ROOT에서 **pnpm으로 이미 확정**되어 있고, 그 위에 얹을 **빌드/태스크 러너**를 결정해야 한다.

필요한 기능:

- 워크스페이스 간 의존성 관리 (이미 pnpm이 처리)
- 빌드/테스트/lint 태스크 오케스트레이션 (`pnpm -r run build`로도 가능하나 캐싱·병렬 실행은 별도 도구 필요)
- 변경된 패키지만 빌드 (CI 시간 단축)
- 학습 곡선이 낮을 것 (학습 영역 6개 중 모노레포 자체가 목표는 아님)

## 결정 (Decision)

**선택**: ✅ **Turborepo** (Accepted)

## 이유 / 트레이드오프

### 왜 Turborepo인가

- **학습 곡선이 가장 낮음** — pnpm workspaces 위에 `turbo.json` 한 파일만 얹으면 끝
- **사이드 프로젝트 규모에 적합** — 2개 앱 + 소수 패키지에는 Nx의 풀 기능이 과함
- **Vercel/Next.js 생태계 사실상 표준** — 본인 메인 스택과 친화적, 실무에 가져갈 가능성도 있음
- **원격 캐싱 무료** — Vercel 계정 연결 시 빌드 캐시 공유 (개인 프로젝트는 0원)
- **NestJS + Expo 둘 다 표준적인 셋업 가이드가 풍부**함

### 얻는 것

- 빠른 빌드 (변경된 패키지만, 캐시된 결과 재사용)
- 일관된 태스크 인터페이스 (`turbo run build`, `turbo run lint`)
- CI 시간 단축 (변경 감지 기반)

### 포기하는 것

- Nx의 강력한 **코드 생성기 (generator)** — 새 패키지 만들 때 `nx g @nx/nest:lib` 같은 자동화 못 씀
- Nx의 **의존성 그래프 시각화 UI** — `turbo` 도 있긴 하지만 약함
- Nx의 **plugin 생태계** — 통합 도구는 Nx가 더 많음
- Nx의 **integrated 모노레포 패턴** (단일 node_modules, 단일 tsconfig 상속 등)

### 학습 가치 관점

- 학습 영역 1순위(인프라/DevOps) 안에 모노레포 도구가 직접 들어가진 않지만, **CI 시간을 줄여 학습 사이클을 빠르게** 한다는 면에서 간접 기여.
- Nx를 굳이 배워야 할 동기가 약함 (실무에서 Nx 만나면 그때 배워도 늦지 않음). Turborepo는 5분이면 익힘.

## 검토한 대안

| 대안                        | 장점                                                 | 단점                                                       | 제외 이유                                    |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| **A. Turborepo** ⭐         | 학습 곡선 낮음, Vercel 친화, 무료 원격 캐싱          | 코드 생성기/플러그인 약함, 의존성 그래프 시각화 약함       | (선택안)                                     |
| **B. Nx**                   | 강력한 생성기, 풍부한 플러그인, 의존성 그래프 시각화 | 학습 곡선 가파름, 설정 복잡, 사이드 규모에 과함            | 학습 비용 대비 가치 낮음 (학습 6영역에 없음) |
| **C. pnpm workspaces only** | 가장 가벼움, 추가 도구 0                             | 빌드 캐싱 없음, 변경 감지 없음, 태스크 오케스트레이션 수동 | CI 시간 누적되면 결국 도구 도입하게 됨       |

## 결과 / 영향

본 결정으로 인해 Phase 1에서 추가로 발생하는 작업:

- `turbo.json` 작성 (root)
- 각 패키지의 `package.json` 에 `scripts` 표준화 (`build`, `dev`, `lint`, `test`, `typecheck`)
- GitHub Actions에서 `turbo run` 사용
- (선택) Vercel 계정 연결로 원격 캐싱 활성화

## 재검토 트리거

다음 중 하나라도 발생하면 이 결정을 재검토:

- 모노레포 내 패키지가 **10개를 넘어감** (Nx의 generator 가치가 커짐)
- 빌드 시간이 **5분을 일관되게 넘어감** + Turborepo 캐싱으로도 해결 안 됨
- 실무에서 **Nx를 본격적으로 쓰게 되어** 사이드에서도 익혀둘 동기가 생김
- Turborepo가 **major break / 유료화** 등으로 방향 전환

## 참고

- [Turborepo 공식 문서](https://turborepo.com/docs)
- [Turborepo + Expo 가이드](https://docs.expo.dev/guides/monorepos/)
- [Nx 공식](https://nx.dev/)
- 학습 노트 (작성 예정): `docs/learnings/turborepo-basics.md`
