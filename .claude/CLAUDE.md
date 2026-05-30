# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참조하는 가이드입니다.
세부 룰 파일들은 같은 디렉토리(`.claude/`) 안에 있으며, Claude는 작업 시 모두 자동 참조합니다.

## 프로젝트 개요

**Trailog** — 여행 사진 지도 아카이브 모바일 앱

- 자세한 컨텍스트: `docs/PROJECT_ROOT.md` 참고 (필독)
- 본 프로젝트는 **학습 목적**이며, 단순히 동작하는 코드보다 **의도적 학습**과 **이유 설명**이 더 중요함

## 개발자 컨텍스트

- 프론트엔드 2년차 (React/Next.js + TypeScript, NestJS 경험)
- **인프라/배포는 처음**이므로 관련 작업 시 친절한 설명 필요
- 모바일 네이티브(React Native)는 새 영역
- 코드만 작성하지 말고, **왜 그렇게 하는지** 같이 설명할 것

## 룰 파일 인덱스 (`.claude/`)

| 파일               | 적용 범위       | 내용                                                                                                 |
| ------------------ | --------------- | ---------------------------------------------------------------------------------------------------- |
| `CLAUDE.md` (this) | 공통            | 협업/문서화/커뮤니케이션 원칙 + 코드 품질 기준 + 룰 인덱스                                           |
| `code-style.md`    | 백엔드 + 모바일 | 메서드 내부 작성 규칙 — early return, 명명, async/await, try/catch, 매개변수, 함수 크기, 빈 줄, 주석 |
| `type-safety.md`   | 백엔드 + 모바일 | `any` 금지, `unknown` + 타입 가드, 어서션 기준, DTO 타입 패턴                                        |
| `nest-backend.md`  | `apps/server/`  | NestJS 모듈/서비스/컨트롤러 책임 분리, DTO/엔티티 패턴, RestResponse, Service 분리 신호              |
| `rn-mobile.md`     | `apps/mobile/`  | 컴포넌트 설계, 화면 구조, 훅 분류, 네이밍, useEffect 제한, 조건부 렌더링, 크기 제한                  |
| `testing.md`       | 백엔드 + 모바일 | Jest 셋업, AC 기반 테스트 케이스, 작성 판단 기준, 모킹 전략                                          |

## 협업 규칙

### 코드 작성 시

1. **설명을 먼저, 코드를 나중에** — 무엇을 왜 만드는지 먼저 말하고 코드 작성
2. **새로운 개념이 나오면 짧게라도 설명** — 본인이 모를 가능성이 있는 패턴/라이브러리는 한두 줄 설명 곁들이기
3. **대안이 있으면 트레이드오프 알려주기** — "이 방법도 있지만 이 프로젝트엔 X가 더 맞음" 식
4. **TypeScript strict 모드 가정** — `any` 남발 금지, 타입 명확히 (자세한 룰은 `type-safety.md`)

### 의사결정 시

1. **모르면 묻기** — 추측 말고 명확히 질문. **추정 답변 금지** — 실제 코드/파일을 read해서 사실 기반으로 답
2. **PROJECT_ROOT의 결정사항을 우선** — 큰 방향은 이미 정해진 것이므로 거기서 벗어나는 제안 시 명시적으로 알리기
3. **안티 패턴 회피** — PROJECT_ROOT 8장의 "하지 말아야 할 것" 준수
   - 새 언어/프레임워크 충동적 도입 금지
   - 처음부터 과도한 추상화/마이크로서비스 금지
   - 측정 전에 최적화하지 않기

### 작업 흐름

1. 큰 작업은 **작은 단위로 쪼개서** 진행
2. 한 번에 너무 많은 파일을 만들지 말고, **단계별로** 만들고 검증
3. 의미 있는 단위마다 **commit message 제안** — Conventional Commits 형식: **prefix는 영어** (`docs:` / `chore:` / `feat:` / `fix:` / `refactor:` / `build:` / `ci:` / `test:` / `style:` / `perf:`) + **본문은 한글**
4. **commit/push 자동 실행 X** — 변경 요약 보여주고 본인 OK 받은 뒤 실행

### 수정 전 확인

코드를 수정하기 전에 항상:

1. **대상 파일 read** — 작성한 적 없거나 컨텍스트가 흐려진 파일은 먼저 read. 머리속 기억에 의존 X.
2. **인접 컨텍스트 확인** — 같은 디렉토리의 형제 파일, 관련 entity/DTO/service, 사용하는 곳(import 사이트)
3. **파급 범위 파악** — DB 마이그레이션이 필요한지, API contract가 깨지는지, 모바일 client에 영향 가는지, 환경변수 추가가 필요한지

## 코드 품질 기준

모든 코드 변경은 아래 5개 기준을 만족해야 한다.

### 1. 가독성 우선

- 짧은 코드보다 **읽기 쉬운 코드**를 우선
- 한 번 읽고 의도를 이해할 수 있어야 함
- 복잡한 로직은 함수/메서드/컴포넌트로 분리

### 2. 변경 범위 최소화

- 하나의 수정은 하나의 문제만 해결
- 관련 없는 리팩토링은 별도 commit으로
- 기존 코드 스타일을 우선 따름

### 3. 지역적 이해 가능성

- 파일 하나만 읽어도 동작을 이해할 수 있어야 함
- 숨겨진 side effect를 만들지 않음
- 한 파일 안에서 흐름이 끊기지 않게

### 4. 명시성

- 숨겨진 로직보다 **명시적인 코드**를 선호
- magic number/string 금지 — 의미 있는 상수로
- 의미 있는 변수명 (`d`, `tmp`, `data2` 금지)

### 5. 일관성

- 새로운 패턴 도입보다 **기존 코드 스타일** 우선
- 같은 문제는 같은 방식으로 해결 (이미 있는 helper, 이미 있는 패턴 활용)

## 문서화 원칙 (중요)

본 프로젝트는 **1인 풀팀 + 문서 자동화** 방식으로 운영됨 (PROJECT_ROOT 5장 참고).

### 핵심 원칙

- **본인(사용자)은 문서를 직접 쓰지 않음**. 모든 마크다운 문서는 Claude가 작성한다.
- 본인은 **프롬프팅, 리뷰, 수정 요청, 추가 학습 요청**만 담당한다.
- 따라서 Claude는 적절한 타이밍에 **먼저 문서 작성을 제안**해야 한다 (사용자가 요청할 때까지 기다리지 말 것).

### Claude가 먼저 제안해야 하는 상황

| 상황                                                   | 작성할 문서                    | 템플릿                             |
| ------------------------------------------------------ | ------------------------------ | ---------------------------------- |
| 새 기능 만들기 시작할 때                               | `docs/specs/feature-xxx.md`    | `docs/templates/spec.md`           |
| 기술적 의사결정이 필요할 때 (라이브러리, 구조 선택 등) | `docs/decisions/XXXX-xxx.md`   | `docs/templates/adr.md`            |
| 본인이 처음 보는 개념이 등장했을 때                    | `docs/learnings/topic-name.md` | `docs/templates/learning-note.md`  |
| 기능 개발 완료 후 캡처가 모였을 때                     | `docs/screens/feature-xxx.md`  | `docs/templates/screen-catalog.md` |

**판단 기준**:

- 학습 노트는 "이 개념, 처음 보거나 헷갈릴 만한가?" 자문하고 그렇다면 제안
- Spec/ADR/화면 카탈로그는 워크플로의 정해진 단계이므로 빠뜨리지 말 것
- 제안할 땐 "이거 노트로 남겨둘까요?" 식으로 짧게 묻기. 매번 작성 강제하진 않음

### 문서 작성 시 규칙

1. **템플릿 사용** — `docs/templates/` 아래의 해당 템플릿을 기반으로 작성
2. **링크 박기** — 관련 Spec/ADR/학습노트를 서로 링크 (마크다운 상대 경로)
3. **변경 이력 갱신** — 같은 토픽으로 추가 학습/수정 시 새 파일 X, 기존 파일에 날짜 헤더로 추가
4. **파일명** — kebab-case, 토픽 기반 (예: `presigned-url-uploads.md`)
5. **ADR 번호** — `0001-`, `0002-` 식으로 4자리 0패딩 + 짧은 슬러그

## 기술 스택 (확정)

확정된 항목 위주. 잠정/Q는 `docs/specs/phase-02-core-features.md` 9장 참고.

### 클라이언트 (apps/mobile/)

- React Native + Expo SDK 56
- TypeScript strict
- 네비게이션: Expo Router
- 보안 저장소: expo-secure-store
- HTTP: 자체 fetch wrapper (`apps/mobile/src/lib/auth/api-client.ts`)
- 상태관리/Form/지도: Phase 2 4.6+에서 결정

### 서버 (apps/server/)

- NestJS + TypeScript strict
- ORM: TypeORM 1.0 ([ADR-0006](../docs/decisions/0006-orm-typeorm.md))
- DB: PostgreSQL (PostGIS 확장 — Phase 2 4.2 도입)
- 인증: JWT (access 15분 + refresh 7일, Stateless) + Passport + bcrypt
- API 문서: Swagger (`/api/docs`)

### 인프라

- 패키지 매니저: pnpm 9.9 + `node-linker=hoisted` ([ADR-0003](../docs/decisions/0003-pnpm-node-linker-hoisted.md))
- 모노레포: Turborepo 2.x ([ADR-0001](../docs/decisions/0001-monorepo-turborepo.md))
- 백엔드 호스팅: Fly.io (nrt 리전) ([ADR-0004](../docs/decisions/0004-backend-hosting-fly-io.md)) → Phase 4 ECS 마이그레이션 ([ADR-0002](../docs/decisions/0002-hybrid-infra-paas-then-aws-ecs.md))
- 이미지 저장: Cloudflare R2 (Phase 2 4.3 도입)
- 문서 publish: Notion + sync 스크립트 ([ADR-0005](../docs/decisions/0005-doc-platform-notion-sync.md))

## 학습 우선순위 (PROJECT_ROOT 2장)

순서대로:

1. 인프라 / 배포 / DevOps
2. 이미지 / 미디어 처리 / 파일 스트리밍
3. 지도 / 데이터 시각화
4. 실시간 통신 (WebSocket/SSE)
5. 성능 최적화 / 캐싱 (Redis)
6. 모바일 네이티브 / 앱 배포

작업 중 위 영역과 관련된 부분이 나오면 **학습 포인트를 명시적으로 강조**해줄 것.

## 커뮤니케이션 톤

- 한국어로 응답
- 너무 격식체보다는 친근한 톤
- 칭찬/아부는 최소화, 실용적인 정보 우선
- 모르면 모른다고, 추측이면 추측이라고 명시 (사실 기반 우선 — 실제 코드를 read 후 답변)

## 자주 참조할 문서

- **`docs/PROJECT_ROOT.md`** ← 새로운 세션 시작 시 항상 먼저 읽을 것 (북극성)
- **`docs/templates/`** — 새 문서 작성 시 출발점이 되는 빈 템플릿 4종
- `docs/specs/` — 기능별 PRD. 작업 전 해당 spec 먼저 확인
- `docs/decisions/` — ADR. 기술 선택 이유가 궁금하면 여기
- `docs/learnings/` — 이전에 작성한 학습 노트. 같은 토픽 다시 등장 시 새 파일 X, 기존 파일에 추가
- `docs/screens/` — 화면 카탈로그. UI 변경 시 함께 갱신

## 검증 명령어

코드 수정 후 반드시 아래 명령어로 검증. 에러 있으면 수정 완료로 간주 X.

```bash
# 전체 (root)
pnpm typecheck         # 모든 패키지 타입 체크
pnpm lint              # ESLint
pnpm test              # Jest (Phase 2 4.2 진입 직전 셋업 예정)

# 백엔드만
pnpm --filter @trailog/server typecheck
pnpm --filter @trailog/server lint
pnpm --filter @trailog/server test

# 모바일만
pnpm --filter @trailog/mobile typecheck
pnpm --filter @trailog/mobile lint
pnpm --filter @trailog/mobile test
```

## 디렉토리 구조 (현재)

```
trailog/
├── apps/
│   ├── mobile/        # React Native (Expo)
│   │   └── src/lib/auth/  # Phase 2 4.1 인증 client
│   └── server/        # NestJS
│       └── src/
│           ├── auth/       # Phase 2 4.1 인증 module
│           ├── users/      # Phase 2 4.1 users module
│           └── database/   # TypeORM data-source + migrations
├── packages/
│   └── eslint-config/ # 공유 ESLint 설정
├── docker/
│   └── compose.yml    # 로컬 Postgres
├── docs/
│   ├── PROJECT_ROOT.md      # 북극성 문서
│   ├── specs/               # 기능 PRD/Spec
│   ├── decisions/           # ADR
│   ├── learnings/           # 학습 노트
│   ├── screens/             # 화면 카탈로그 + 캡처
│   └── templates/           # 빈 템플릿 4종
├── .claude/           # Claude Code 룰 디렉토리 (이 파일 포함)
├── fly.toml           # Fly.io 배포 설정
└── CLAUDE.md          # → .claude/CLAUDE.md 로 통합됨 (현 파일이 그것)
```
