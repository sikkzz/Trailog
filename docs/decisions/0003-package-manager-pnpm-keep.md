# ADR-0003: 패키지 매니저 — pnpm 유지 (npm/Yarn Berry 검토 후)

> **상태**: ✅ Accepted (확정 2026-05-24)
> **날짜**: 2026-05-24
> **결정자**: @sikkzz (제안: Claude)
> **관련 문서**: [ADR-0001 모노레포 빌드 도구](./0001-monorepo-tool.md), [pnpm workspaces 학습 노트](../learnings/pnpm-workspaces.md), [Expo + RN 기초](../learnings/expo-and-react-native-basics.md)

---

## 맥락 (Context)

프로젝트 초기 PROJECT_ROOT 4장에서 패키지 매니저로 **pnpm**을 잠정 선택. ADR-0001은 모노레포 **빌드 도구(Turborepo)** 결정이고, 그 위의 패키지 매니저는 pnpm으로 가정.

### Phase 1 진행 중 발견한 문제

Expo + RN 모바일 앱 셋업 시 **pnpm의 비호이스팅 정책 ↔ Expo/RN의 transitive import 패턴 충돌**:

```
@expo/metro-runtime → @expo/log-box (못 찾음)
```

→ 임시 해결: 루트 `.npmrc`에 `node-linker=hoisted` 추가. pnpm을 npm/yarn처럼 호이스팅 모드로 동작시켜 Metro가 표준 lookup 가능하게.

### 본인 우려 (2026-05-24)

```
"node-linker=hoisted 트릭으로 pnpm의 핵심 가치(strict 의존성 검증,
유령 의존성 방지)가 사실상 깨졌다. 그러면 pnpm을 쓰는 의미가 없지
않냐? 다른 패키지 매니저로 바꾸는 건?"
```

본인 추가 우려:

- **보편적 스택**으로 학습해야 함 (실무 학습 시장 시그널)
- **실무 환경 일치** 가치 (참조 메인 백엔드는 npm 사용)

## 우리가 실제로 시도한 것 (학습 가치)

이 결정에 앞서 두 가지 대안을 **실제로 마이그레이션 시도**했고 그 결과를 정직히 기록:

### 시도 1: npm으로 마이그레이션

- `pnpm-workspace.yaml` 삭제 → 루트 `package.json`의 `workspaces` 필드 추가
- `workspace:^` → `*` 변경
- `packageManager: npm@10.7.0`
- `pnpm-lock.yaml` 삭제 → `npm install` → `package-lock.json` 생성
- **결과**: 동작 OK (1034 패키지 install, typecheck/lint/format 통과)
- **그러나**: 다른 세션의 분석(`Yarn Berry > pnpm > npm` 우선순위) 검토 후 재고
  - npm은 Turborepo 통합 가장 약함
  - `turbo prune` + Docker 최적화 약함 (Phase 4 AWS ECS 영향)
  - phantom dependency 그대로 노출
  - `resolutions`/`constraints` 같은 모노레포 기능 부재

### 시도 2: Yarn Berry (4.15.0, nodeLinker: node-modules)로 마이그레이션

- `corepack use yarn@stable` → yarn 4.15.0 자동 활성
- `.yarnrc.yml` 작성: `nodeLinker: node-modules` (PnP 끄고 평탄한 `node_modules`)
- **결과**: ❌ `YN0016` quarantine 에러로 install 실패
  ```
  @expo/metro-runtime@npm:^56.0.12: All versions satisfying "^56.0.12" are quarantined
  ```
- Yarn 4의 supply-chain 보안 메커니즘이 Expo SDK 56 의존성을 차단
- `enableHardenedMode: false` + `YARN_ENABLE_HARDENED_MODE=false` 환경변수 모두 효과 없음
- 다른 우회 옵션은 시간 대비 학습 가치 낮음 → 포기

## 결정 (Decision)

**선택**: ✅ **pnpm 유지** (`.npmrc node-linker=hoisted` 트릭 포함)

세부:

- 패키지 매니저: pnpm 9.9.0 (변경 없음)
- 워크스페이스: `pnpm-workspace.yaml` (변경 없음)
- 의존성 표기: `workspace:^` (변경 없음)
- `.npmrc`: `node-linker=hoisted` + `strict-peer-dependencies=false` + `auto-install-peers=true` (현재 그대로 유지)
- 모노레포 빌드 도구: **Turborepo** (ADR-0001, 변경 없음)

## 이유 / 트레이드오프

### 왜 pnpm 유지인가

#### 1. **학습 영역 6개에 "패키지 매니저"는 없음** ⭐

PROJECT_ROOT 2장 학습 우선순위:

1. 인프라 / DevOps
2. 이미지 / 미디어 처리
3. 지도 / 시각화
4. 실시간 통신
5. 캐싱
6. 모바일 네이티브 + 앱 배포

→ 패키지 매니저 선정에 더 시간 쓰는 건 **PROJECT_ROOT 8장 안티패턴 6번 ("포기하지 말 것의 함정")** 신호. 완벽한 선택보다 **충분히 좋은 선택**으로 본진 가는 게 합리적.

#### 2. **이미 동작 검증된 상태**

- iOS 시뮬레이터 + Android 에뮬레이터 양쪽 "Trailog" 화면 검증 완료 (commit `8bed4a4`)
- typecheck/lint/format 모두 통과
- 추가 비용 0

#### 3. **다른 옵션이 명확히 더 낫지 않다는 게 검증됨**

- **npm**: 동작은 하지만 객관적 모노레포 기능 약함 (Turborepo 통합/Docker 최적화/Constraints)
- **Yarn Berry**: 객관적 best 후보였지만 Expo SDK 56 quarantine 이슈로 실제 셋업 막힘. 시간 대비 학습 가치 낮음.
- **Yarn Classic 1.x**: maintenance 모드, 시그널 약함
- **bun**: 신생, RN production 검증 부족

→ "이론상 최적"인 Yarn Berry가 "실제 작동"으로 안 이어졌고, 그 디버깅 시간 자체가 안티패턴.

#### 4. **pnpm의 진짜 잃은 가치는 일부일 뿐**

`node-linker=hoisted` 후에도 유지되는 pnpm 장점:

- ✅ content-addressable store (`~/.pnpm-store/`) → 글로벌 캐시 + hard link로 디스크 절약
- ✅ workspace protocol (`workspace:^`)
- ✅ `pnpm --filter` 명령
- ✅ `pnpm-lock.yaml` (npm/yarn 대비 정확한 lockfile)
- ✅ 빠른 install

잃은 것:

- ❌ 유령 의존성 방지 (strict 의존성 검증)
- ❌ 각 패키지가 자기 의존성만 봄

→ **30% 정도 잃었지만 70%는 유지**. "완전 깨졌다"는 과장.

#### 5. **패키지 매니저는 나중에 바꾸기 비교적 쉬움**

- 이번에 실제 마이그레이션 시도 두 번 = 각 30~60분
- Phase 4 진입 시점에 Expo SDK 안정화되면 Yarn Berry 재시도 가능
- 또는 트래픽/규모 변화에 따라 npm 검토 가능
- **첫 결정에 100% 무게 둘 필요 없음**

### 얻는 것

- **본진 시간 최대화** (이미지 파이프라인/지도/모바일 학습)
- **검증된 동작** (iOS/Android 양쪽 OK)
- **pnpm 학습 가치 그대로** (workspace protocol, 호이스팅 차이, lockfile, symlink)
- **결정 변경 비용 최소** (commit 0)

### 포기하는 것

- **본인 우려 완전 해소 X** — pnpm 가치 일부 깨진 상태 그대로
- **실무 환경 일치 X** (실무는 npm)
- **객관적 최적 모노레포 도구 X** (Yarn Berry가 더 강력하지만 실제 셋업 불가)
- **Phase 4 Docker 최적화** — pnpm + `turbo prune`이 강하긴 한데 hoisted 모드라 일부 효과 약화

### 학습 가치 관점

**얻음**:

- 패키지 매니저 3가지 (npm/pnpm/Yarn Berry) 실제 비교 경험
- Yarn 4의 supply-chain 보안 (`YN0016` quarantine, hardened mode) 학습
- "이론상 최적 ≠ 실제 최적" 경험
- **도구 선정에 너무 시간 쓰면 안티패턴**이라는 깨달음

**박제**:

- 이 ADR 자체가 학습 자료
- 미래에 비슷한 결정 만났을 때 첫 참조

## 검토한 대안 정리

| 대안                                                | 객관적 평가             | 실제 시도 결과                   | 우리 케이스 적합도        |
| --------------------------------------------------- | ----------------------- | -------------------------------- | ------------------------- |
| **A. pnpm 현재 (hoisted)** ⭐                       | 70% 가치 유지, 30% 잃음 | ✅ 동작 검증됨                   | (선택안)                  |
| B. pnpm + precise hoisting (`public-hoist-pattern`) | 가치 80% 회복           | 미시도                           | 트릭 복잡, 패턴 추가 부담 |
| C. npm                                              | 단순, 실무 일치         | ✅ 동작 (시도 1)                 | 모노레포 기능 약함        |
| D. Yarn Berry (nodeLinker: node-modules)            | 객관적 best             | ❌ Expo quarantine 실패 (시도 2) | 디버깅 시간 ↑             |
| E. Yarn Classic 1.x                                 | maintenance             | 미시도                           | deprecated 추세           |
| F. bun                                              | 빠르지만 신생           | 미시도                           | RN production 검증 부족   |

## 재검토 트리거

다음 중 하나라도 발생하면 이 결정을 재검토:

- **Phase 4 진입 시점 (~3개월 후)**: AWS ECS Docker 이미지 빌드 시 pnpm+`turbo prune`이 hoisted 모드라 효과 일부 약화. 그때 측정 후 결정.
- **Yarn Berry의 quarantine 이슈가 해결됨** + Expo SDK 안정화 → Yarn Berry 재시도 검토.
- **`@expo/log-box` 류 transitive import 이슈가 재발하지만 hoisted로 해결 안 됨** → precise hoisting 또는 다른 PM 검토.
- **실무가 패키지 매니저 변경 (npm → 다른 거)** → 일관성 위해 재검토.
- **모노레포 패키지가 10개 이상으로 증가** → install 속도/관리 부담 측정 후 재고.

## 학습 노트 영향

- `pnpm-workspaces.md`: **그대로 유효**. 본 ADR-0003에 따라 pnpm 유지 결정. 결정 변경 알림 헤더 불필요.
- `expo-and-react-native-basics.md`: "흔한 함정"의 `.npmrc node-linker=hoisted` 설명 그대로 유효.

## PROJECT_ROOT 영향

- 4장 인프라 표에 패키지 매니저 명시 추가 (pnpm 9.9.0)
- 11장 변경 이력에 "패키지 매니저 재검토 후 pnpm 유지" 한 줄 추가

## 후속 작업

- [ ] PROJECT_ROOT 4장 인프라 표 + 11장 변경 이력 업데이트
- [ ] 본인 iTerm에서 iOS/Android 시뮬레이터 한 번 더 동작 확인 (안전 차원)
- [ ] ADR-0003 + PROJECT_ROOT 변경 commit + push

## 참고

- [pnpm 공식 - node-linker](https://pnpm.io/npmrc#node-linker)
- [Yarn Berry 공식 - nodeLinker](https://yarnpkg.com/configuration/yarnrc#nodeLinker)
- [Expo monorepo 가이드](https://docs.expo.dev/guides/monorepos/)
- 관련 학습 노트: [pnpm Workspaces](../learnings/pnpm-workspaces.md), [Expo + RN 기초](../learnings/expo-and-react-native-basics.md)
- 실무 환경 비교: 참조 메인 백엔드는 npm 사용 (`package-lock.json` 보유)
