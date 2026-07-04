# Trailog

> **Trail**(발자취) + **Log**(기록). 여행 사진을 지도 위에 아카이브하는 모바일 앱.
>
> 학습 + 취미 + 포트폴리오를 위한 사이드 프로젝트. **자세한 컨텍스트**는 [docs/PROJECT_ROOT.md](./docs/PROJECT_ROOT.md) (북극성 문서).

## 🎉 1차 마무리 완료 (2026-07-04)

Phase 1~3 (약 6.5주) 4개 wave 완주 후 **1차 마무리 시점 확정**. 자세한 결정 사유: [ADR-0017 1차 마무리 시점](./docs/decisions/0017-first-milestone-scope.md).

- ✅ **최소 성공 달성** (PROJECT_ROOT 9장 Must — 실 디바이스 실사용 + 학습 영역 4개+ + 정리된 코드/README)
- ✅ **학습 영역 4/6 완주** — #1 인프라/DevOps · #2 이미지/미디어 · #3 지도/시각화(표시/클러스터) · #4 실시간 통신(SSE)
- ✅ **누적 자산** — ADR 17건 · 학습 노트 34건 · 3앱 모노레포 (mobile/server/web)
- 🅿️ **Phase 4 (스토어 배포 + AWS ECS) 보류** — 실 사용자 확보 계획 없이 실비/오버킬 트레이드오프 X. 2차 확장 후보로 박제
- 🅿️ **Trip + 타임라인 wave 보류** — 필수 X, 재활성 트리거 대기

---

## 한눈에 보기

- **클라이언트**: React Native + Expo SDK 56 (`apps/mobile`)
- **백엔드**: NestJS + TypeScript (`apps/server`)
- **DB**: PostgreSQL 16 + PostGIS 3.4 (Docker 로컬)
- **캐시/큐**: Redis 7 + BullMQ (Phase 2~)
- **모노레포**: pnpm 9 workspaces + Turborepo 2.x
- **배포**: Fly.io (Phase 1~3 백엔드) → AWS ECS Fargate (Phase 4+)
- **문서 publish**: Notion + 자체 sync 스크립트 + GitHub Actions

학습 목적 운영 방식:

- **1인 풀팀**: 기획/디자인/개발/QA/배포를 본인이 모두 수행
- **문서 자동화**: 모든 마크다운은 Claude(AI)가 작성, 본인은 프롬프팅·리뷰·실행만
- **의도적 학습 영역**: 인프라/DevOps → 이미지/미디어 → 지도 → 실시간 → 캐싱 → 모바일 네이티브

자세한 운영 방식: [PROJECT_ROOT 5장](./docs/PROJECT_ROOT.md#5-운영-방식--1인-풀팀--문서-자동화)

---

## Quick Start (5분 셋업)

### 사전 요구사항

| 도구           | 버전         | 확인                          |
| -------------- | ------------ | ----------------------------- |
| Node.js        | **20.19.4+** | `.nvmrc` (`nvm use`로 자동)   |
| pnpm           | **9.9.0**    | `corepack enable`로 자동 활성 |
| Docker Desktop | latest       | `docker --version`            |
| (선택) Xcode   | latest       | iOS 빌드용                    |

### 1. Clone + 의존성 설치

```bash
git clone https://github.com/sikkzz/Trailog.git
cd Trailog

# Node 버전 맞추기 (.nvmrc 자동 인식)
nvm use

# pnpm 활성 + 전체 의존성 설치
corepack enable
pnpm install
```

### 2. 환경변수 셋업

```bash
cp .env.example .env
# 필요 시 본인 환경에 맞게 수정 (기본값으로도 동작)
```

`apps/server`, `apps/mobile`도 각자 `.env.example`이 있음. 현재 Phase 1엔 기본값으로 충분.

### 3. 로컬 인프라 띄우기 (Docker)

```bash
pnpm db:up   # Postgres + Redis 컨테이너 시작
```

상태 확인:

```bash
docker ps   # trailog-postgres, trailog-redis 두 컨테이너 보이면 OK
```

### 4. 개발 서버 실행

```bash
pnpm dev   # 모든 앱 동시 실행 (turbo)
```

또는 개별:

```bash
pnpm --filter @trailog/server dev   # NestJS (http://localhost:3000)
pnpm --filter @trailog/mobile dev   # Expo dev server
```

### 5. 동작 확인

```bash
curl http://localhost:3000/health
# {"status":"ok"}

# 운영 (Fly.io 자동 배포)
curl https://trailog-server.fly.dev/health
```

---

## 디렉토리 구조

```
Trailog/
├── apps/
│   ├── mobile/             # React Native + Expo
│   │   ├── src/app/        # Expo Router 라우트
│   │   ├── eas.json        # EAS Build profile (dev/preview/production)
│   │   └── .env.example
│   └── server/             # NestJS
│       ├── src/
│       │   ├── main.ts     # bootstrap
│       │   └── health/     # /health 엔드포인트
│       ├── Dockerfile      # Fly.io 배포용
│       └── .env.example
│
├── packages/
│   └── eslint-config/      # 공유 ESLint 룰 (base / nest / expo)
│
├── docker/
│   └── compose.yml         # 로컬 Postgres(PostGIS) + Redis
│
├── docs/                   # 모든 문서 (Claude가 작성)
│   ├── PROJECT_ROOT.md     # ★ 북극성 문서 (먼저 읽기)
│   ├── decisions/          # ADR — 기술 의사결정 기록 (5개)
│   ├── specs/              # 기능 PRD (Phase 1)
│   ├── learnings/          # 학습 노트 (11개+)
│   ├── screens/            # 화면 카탈로그 (Phase 2~)
│   └── templates/          # 새 문서 작성용 빈 템플릿 4종
│
├── scripts/
│   └── sync-to-notion.mjs  # docs/ → Notion 자동 publish
│
├── .github/workflows/
│   ├── ci.yml              # PR/main: lint + typecheck + build
│   ├── deploy.yml          # main: Fly.io 자동 배포
│   └── notion-sync.yml     # main + docs/**: Notion sync
│
├── fly.toml                # Fly.io 배포 설정
├── CLAUDE.md               # Claude 협업 가이드
└── README.md               # 이 파일
```

---

## 주요 명령어

### 개발

| 명령어                                     | 설명                                                |
| ------------------------------------------ | --------------------------------------------------- |
| `pnpm dev`                                 | 모든 앱 동시 실행 (turbo)                           |
| `pnpm --filter @trailog/server dev`        | 백엔드만                                            |
| `pnpm --filter @trailog/mobile dev`        | 모바일만 (Expo)                                     |
| `pnpm --filter @trailog/mobile dev:tunnel` | 모바일 + ngrok tunnel (실기기 + 5G 또는 다른 Wi-Fi) |

### 로컬 인프라

| 명령어          | 설명                     |
| --------------- | ------------------------ |
| `pnpm db:up`    | Postgres + Redis 시작    |
| `pnpm db:down`  | 정지                     |
| `pnpm db:logs`  | 로그 follow              |
| `pnpm db:psql`  | Postgres CLI 접속        |
| `pnpm db:redis` | Redis CLI 접속           |
| `pnpm db:reset` | volume까지 삭제 + 재시작 |

### 품질 검증

| 명령어           | 설명                         |
| ---------------- | ---------------------------- |
| `pnpm lint`      | ESLint 전체                  |
| `pnpm typecheck` | TypeScript strict 검사       |
| `pnpm build`     | 전체 빌드 (turbo cache 활용) |
| `pnpm format`    | Prettier 전체                |

### 모바일 빌드

| 명령어                                            | 설명                                                        |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `pnpm --filter @trailog/mobile build:dev:ios`     | EAS Cloud iOS dev build (Apple Developer 필요, Phase 4부터) |
| `pnpm --filter @trailog/mobile build:dev:android` | EAS Cloud Android dev build                                 |
| `pnpm --filter @trailog/mobile build:production`  | 스토어 출시용                                               |

Phase 1엔 iOS는 **로컬 Xcode + Personal Team** 경로 사용. 자세한 흐름: [eas-and-mobile-build.md](./docs/learnings/eas-and-mobile-build.md)

### 문서 publish

| 명령어                 | 설명                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `pnpm sync:notion`     | 로컬에서 docs/ → Notion 즉시 sync (NOTION_TOKEN + NOTION_PARENT_PAGE_ID 환경변수 필요) |
| `pnpm sync:notion:dry` | dry-run (실제 변경 X)                                                                  |

---

## 환경변수

| 위치               | 용도           | 주요 키                                                                            |
| ------------------ | -------------- | ---------------------------------------------------------------------------------- |
| `.env` (루트)      | docker-compose | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `REDIS_PORT` |
| `apps/server/.env` | 백엔드         | `PORT`, (Phase 2~) `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`                       |
| `apps/mobile/.env` | 모바일         | (Phase 2~) `EXPO_PUBLIC_API_URL`                                                   |

⚠️ 모든 `.env`는 `.gitignore`로 추적 X. `.env.example`만 git에 박힘.

**운영 환경 (Fly.io)**: `fly secrets set KEY=VALUE`로 주입. 로컬 `.env`는 사용 안 함.

**GitHub Actions Secrets** (Settings → Secrets and variables → Actions):

- `FLY_API_TOKEN` — Fly.io 자동 배포
- `NOTION_TOKEN` + `NOTION_PARENT_PAGE_ID` — Notion sync

---

## CI/CD

매 main 푸시마다 GitHub Actions:

| Workflow          | 트리거                                         | 동작                     |
| ----------------- | ---------------------------------------------- | ------------------------ |
| `ci.yml`          | PR/main (paths-ignore: `docs/**`)              | lint + typecheck + build |
| `deploy.yml`      | main (`apps/server/**`, `fly.toml` 등)         | Fly.io 자동 deploy       |
| `notion-sync.yml` | main (`docs/**`, `scripts/sync-to-notion.mjs`) | docs → Notion publish    |

로컬 안전망 (husky):

- `pre-commit`: lint-staged (변경 파일만 ESLint + Prettier)
- `commit-msg`: commitlint (Conventional Commits, prefix 영어 + 본문 한글)
- `pre-push`: typecheck 전체

---

## 기술 스택 요약

| 영역          | 선택                                                | 결정 문서                                                           |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------- |
| 모노레포 도구 | Turborepo 2.x                                       | [ADR-0001](./docs/decisions/0001-monorepo-tool.md)                  |
| 인프라 전략   | PaaS(Phase 1~3) → AWS ECS Fargate(Phase 4+)         | [ADR-0002](./docs/decisions/0002-hybrid-infra-paas-then-aws-ecs.md) |
| 패키지 매니저 | pnpm 9.9.0 + `node-linker=hoisted`                  | [ADR-0003](./docs/decisions/0003-package-manager-pnpm-keep.md)      |
| 백엔드 호스팅 | Fly.io (region=nrt)                                 | [ADR-0004](./docs/decisions/0004-paas-tool-flyio.md)                |
| 문서 publish  | Notion + 자체 sync 스크립트                         | [ADR-0005](./docs/decisions/0005-docs-publishing-notion-sync.md)    |
| 이미지 저장   | Cloudflare R2 (10GB 무료, egress 0)                 | (Phase 2 진입 시 ADR)                                               |
| DB 호스팅     | Supabase 또는 Neon (Phase 1~3) → AWS RDS (Phase 4+) | (Phase 2 진입 시 ADR)                                               |

전체 기술 스택: [PROJECT_ROOT 4장](./docs/PROJECT_ROOT.md#4-기술-스택)

---

## 문서 안내

- **[`docs/PROJECT_ROOT.md`](./docs/PROJECT_ROOT.md)** ★ — 북극성. 항상 먼저 읽을 것.
- **[`docs/decisions/`](./docs/decisions/)** — ADR (Architecture Decision Records) 5건
- **[`docs/specs/`](./docs/specs/)** — 기능 PRD (현재 Phase 1)
- **[`docs/learnings/`](./docs/learnings/)** — 학습 노트 11개+ (각 토픽마다 한 파일)
- **[`docs/templates/`](./docs/templates/)** — 새 문서 작성용 빈 템플릿 4종 (Spec / ADR / Learning Note / Screen Catalog)
- **[`CLAUDE.md`](./CLAUDE.md)** — Claude 협업 시 참조 가이드 (협업 룰, 톤, 문서화 원칙)

같은 문서를 Notion에서도 확인 가능 (GitHub Actions가 자동 sync).

---

## 진행 상황 — 1차 마무리 완료 (2026-07-04)

### ✅ Phase 1: 기초 셋업 + 조기 배포 (2026-05-28 완료)

pnpm 모노레포 + Turborepo · NestJS + Expo · ESLint/Prettier/TS strict · Docker Compose(Postgres+Redis) · GitHub Actions CI(lint+typecheck+build) · Fly.io 자동 배포 · husky 4계층 안전망 · Notion 문서 publish 자동화 · iOS/Android dev build.

자세한 진행: [`docs/specs/phase-01-bootstrap.md`](./docs/specs/phase-01-bootstrap.md)

### ✅ Phase 2: 핵심 도메인 + 이미지 파이프라인 + 지도 (2026-06-08 완료)

인증(JWT+bcrypt+expo-secure-store) · TypeORM+PostGIS · 사진 파이프라인(R2 presigned + BullMQ sharp 3-size + EXIF 추출) · 지도(NaverMap + 클러스터 + PostGIS bbox + NCP Reverse Geocoding) · 모바일 첫 화면(Expo Router + react-hook-form + Zod + React Query) · NativeWind + Pretendard + a11y.

자세한 진행: [`docs/specs/phase-02-core-features.md`](./docs/specs/phase-02-core-features.md)

### ✅ Phase 3: 사진 공유 + EXIF strip + 실시간 통신 (2026-07-03 완료)

공유 링크(nanoid + 만료 + 비밀번호 + Next 16 사이드 페이지) · EXIF strip(piexifjs + Lazy 캐싱 + 백엔드 proxy 다운로드) · SSE(NestJS `@Sse` + RxJS Subject + react-native-sse + 알림 센터 + 뱃지) · 학습 노트 4건 마감.

자세한 진행: [`docs/specs/phase-03-sharing.md`](./docs/specs/phase-03-sharing.md)

### 🅿️ 2차 확장 후보 (보류)

1차 마무리 결정으로 아래는 미래 트리거 대기 상태로 박제 ([ADR-0017](./docs/decisions/0017-first-milestone-scope.md) 참고):

- **Trip + polyline + 타임라인** — 지도/시각화 심화 (spec 보존: [`phase-03-ext-trip-timeline.md`](./docs/specs/phase-03-ext-trip-timeline.md))
- **스토어 배포** — Apple Developer + Google Play + EAS Submit + TestFlight/Play 내부 트랙
- **관측 인프라 최소** — Sentry 3앱 통합 + 구조화 로깅 + 비용 알람
- **AWS ECS 마이그레이션** — Fly.io → ECS Fargate + RDS + ElastiCache + Terraform (spec 보존: [`phase-04-operations-and-aws-migration.md`](./docs/specs/phase-04-operations-and-aws-migration.md))
- **사진 편집 / 검색 / 태그 / 즐겨찾기** — 사용자 피드백 우선순위 상승 시

---

## 라이센스

학습/포트폴리오 목적의 사이드 프로젝트. 별도 라이센스 명시 없음 — 본인 외 사용 X.
