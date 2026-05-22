# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참조하는 가이드입니다.

## 프로젝트 개요

**Trailog** — 여행 사진 지도 아카이브 모바일 앱

- 자세한 컨텍스트: `docs/PROJECT_ROOT.md` 참고 (필독)
- 본 프로젝트는 **학습 목적**이며, 단순히 동작하는 코드보다 **의도적 학습**과 **이유 설명**이 더 중요함

## 개발자 컨텍스트

- 프론트엔드 2년차 (React/Next.js + TypeScript, NestJS 경험)
- **인프라/배포는 처음**이므로 관련 작업 시 친절한 설명 필요
- 모바일 네이티브(React Native)는 새 영역
- 코드만 작성하지 말고, **왜 그렇게 하는지** 같이 설명할 것

## 협업 규칙

### 코드 작성 시

1. **설명을 먼저, 코드를 나중에** — 무엇을 왜 만드는지 먼저 말하고 코드 작성
2. **새로운 개념이 나오면 짧게라도 설명** — 본인이 모를 가능성이 있는 패턴/라이브러리는 한두 줄 설명 곁들이기
3. **대안이 있으면 트레이드오프 알려주기** — "이 방법도 있지만 이 프로젝트엔 X가 더 맞음" 식
4. **TypeScript strict 모드 가정** — any 남발 금지, 타입 명확히

### 의사결정 시

1. **모르면 묻기** — 추측 말고 명확히 질문
2. **PROJECT_ROOT의 결정사항을 우선** — 큰 방향은 이미 정해진 것이므로 거기서 벗어나는 제안 시 명시적으로 알리기
3. **안티 패턴 회피** — PROJECT_ROOT 8장의 "하지 말아야 할 것" 준수
   - 새 언어/프레임워크 충동적 도입 금지
   - 처음부터 과도한 추상화/마이크로서비스 금지
   - 측정 전에 최적화하지 않기

### 작업 흐름

1. 큰 작업은 **작은 단위로 쪼개서** 진행
2. 한 번에 너무 많은 파일을 만들지 말고, **단계별로** 만들고 검증
3. 의미 있는 단위마다 **commit message 제안** — Conventional Commits 형식: **prefix는 영어** (`docs:` / `chore:` / `feat:` / `fix:` / `refactor:` / `build:` / `ci:` / `test:` / `style:` / `perf:`) + **본문은 한글**

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

## 기술 스택 (확정/잠정)

### 클라이언트

- React Native + Expo (SDK 최신)
- TypeScript (strict)
- 상태관리: Zustand 또는 Redux Toolkit + React Query
- 네비게이션: Expo Router

### 서버

- NestJS + TypeScript
- ORM: Prisma (잠정)
- DB: PostgreSQL (PostGIS 확장으로 위치 쿼리)
- 캐시/큐: Redis + BullMQ
- 이미지 처리: sharp

### 인프라

- 패키지 매니저: pnpm
- 모노레포: Turborepo (잠정)
- 로컬: Docker Compose (Postgres + Redis)
- 이미지 저장: Cloudflare R2
- 백엔드 호스팅: Railway 또는 Fly.io (학습 후 AWS 옵션)

## 디렉토리 구조 (계획)

```
trailog/
├── apps/
│   ├── mobile/        # React Native (Expo)
│   └── server/        # NestJS
├── packages/
│   ├── shared-types/  # 공유 타입 (DTO 등)
│   └── eslint-config/ # 공유 ESLint 설정
├── docker/
│   └── compose.yml    # 로컬 DB/Redis
├── docs/
│   ├── PROJECT_ROOT.md  # 프로젝트 북극성 문서 (필독)
│   ├── specs/           # 기능 PRD/Spec (Claude 작성)
│   ├── decisions/       # ADR — Architecture Decision Records (Claude 작성)
│   ├── learnings/       # 학습 노트 (Claude 작성)
│   ├── screens/         # 화면 카탈로그 + 캡처 (Claude 작성, 본인이 캡처 제공)
│   │   └── images/
│   └── templates/       # 빈 템플릿 (spec/adr/learning-note/screen-catalog)
└── CLAUDE.md
```

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
- 너무 격식체보다는 친근한 톤 (지금까지의 대화처럼)
- 칭찬/아부는 최소화, 실용적인 정보 우선
- 모르면 모른다고, 추측이면 추측이라고 명시

## 자주 참조할 문서

- **`docs/PROJECT_ROOT.md`** ← 새로운 세션 시작 시 항상 먼저 읽을 것 (북극성)
- **`docs/templates/`** — 새 문서 작성 시 출발점이 되는 빈 템플릿 4종
- `docs/specs/` — 기능별 PRD. 작업 전 해당 spec 먼저 확인
- `docs/decisions/` — ADR. 기술 선택 이유가 궁금하면 여기
- `docs/learnings/` — 이전에 작성한 학습 노트. 같은 토픽 다시 등장 시 새 파일 X, 기존 파일에 추가
- `docs/screens/` — 화면 카탈로그. UI 변경 시 함께 갱신
