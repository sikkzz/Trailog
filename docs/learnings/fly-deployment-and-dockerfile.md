# Fly.io 배포 + Dockerfile (모노레포 production)

> **작성일**: 2026-05-24
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라 / DevOps (1순위 — 첫 클라우드 배포 + Dockerfile 직접 작성)
> **관련 문서**: [Phase 1 Spec 4.4](../specs/phase-01-bootstrap.md), [ADR-0002 하이브리드 인프라](../decisions/0002-hybrid-infra-paas-then-aws-ecs.md), [ADR-0004 Fly.io](../decisions/0004-paas-tool-flyio.md), [Docker 기초](./docker-basics-and-real-world-backend.md)

---

## 한 줄 요약

**Fly.io**는 컨테이너 기반 PaaS. 사용자는 **Dockerfile + fly.toml** 두 파일로 배포 정의하고 `fly deploy` 한 줄로 클라우드(머신 = micro-VM)에 배포. AWS ECS와 멘탈 모델 90% 공통이라 [Phase 4 마이그레이션의 워밍업](../decisions/0002-hybrid-infra-paas-then-aws-ecs.md)으로 채택.

## 우리 프로젝트에서 어디에 쓰이는가

- `apps/server/Dockerfile` — NestJS production 이미지
- `fly.toml` (루트) — Fly.io 배포 설정
- `.dockerignore` (루트) — 이미지에서 제외할 파일들
- `.github/workflows/deploy.yml` — main 머지 시 자동 배포
- 공개 URL: `https://trailog-server.fly.dev/health` (200 OK)

## 핵심 개념 6가지

### 1. Fly.io의 단위 — **App / Machine / Volume / Region**

| 단위        | 의미                                                            |
| ----------- | --------------------------------------------------------------- |
| **App**     | 하나의 서비스 단위 (예: `trailog-server`). AWS ECS Service 대응 |
| **Machine** | 실제 도는 micro-VM (Firecracker 기반). AWS ECS Task 대응        |
| **Volume**  | 영속 디스크 (Phase 2 사진 업로드 시 사용 예정 X — R2로 외부화)  |
| **Region**  | 데이터센터 위치. 우리는 `nrt` (도쿄) — 한국에서 가장 가까움     |

### 2. fly.toml — 배포 설정의 source of truth

```toml
app = 'trailog-server'
primary_region = 'nrt'

[build]
dockerfile = 'apps/server/Dockerfile'

[env]
NODE_ENV = 'production'
PORT = '3000'

[http_service]
internal_port = 3000
force_https = true
auto_stop_machines = 'stop'      # 트래픽 없으면 자동 중지 → 비용 절약
auto_start_machines = true       # 요청 들어오면 자동 시작
min_machines_running = 0         # hobby plan 비용 최적

[[http_service.checks]]
grace_period = '10s'
interval = '30s'
method = 'GET'
timeout = '5s'
path = '/health'

[[vm]]
size = 'shared-cpu-1x'
memory = '256mb'
```

핵심 포인트:

- **`auto_stop_machines = 'stop'` + `min_machines_running = 0`** = 사이드 트래픽 0일 때 비용 0. 요청 들어오면 자동 부팅 (몇 초 콜드 스타트)
- **`http_service.checks`** = Fly가 자동 헬스체크. `/health` 200 안 되면 라우팅 안 함

### 3. Production Dockerfile — multi-stage vs single-stage trade-off

이상적: **multi-stage**

- builder stage: 모든 deps + build
- runner stage: dist + production deps만
- 이미지 크기 ↓ (보통 30~50% 작아짐)

우리 케이스 (단순화): **single-stage**

- pnpm 모노레포 + `node-linker=hoisted` 조합에서 `pnpm deploy --prod` 가 symlink 충돌 만남
- "동작 보장" + "본진 시간 우선"으로 single-stage 채택
- 이미지 크기: ~325 MB (dev deps 포함)

향후 개선 후보 (Phase 4 ECS 마이그레이션 시):

- multi-stage + `pnpm fetch` + `pnpm install --offline --prod` 분리
- 또는 `pnpm deploy` 의 다른 옵션 (`--shamefully-hoist` 등)
- 이미지 크기 ↓ 30~50% 가능

### 4. .dockerignore — 빌드 컨텍스트 정리

빌드 컨텍스트를 모노레포 루트로 잡으면 `node_modules`, `dist`, `.git`, `docs` 등 거대한 디렉토리가 컨텍스트에 포함됨 → **빌드 시간 ↑, 보안 위험 ↑** (secrets, 환경변수 노출).

우리 `.dockerignore` 주요 항목:

```
**/node_modules        # builder가 fresh install → 컨텍스트엔 불필요
**/dist                # 이미지 안에서 새로 빌드
**/.env                # 시크릿은 fly secrets로
.git                   # 이미지 안에 git history 불필요
docs                   # production 이미지에 문서 X
apps/mobile            # 백엔드 이미지에 모바일 코드 X
.husky                 # git hooks 불필요
```

### 5. 모노레포 빌드 컨텍스트 — 루트로 빌드

```
fly.toml 위치: /Trailog/fly.toml             ← 빌드 컨텍스트 root
Dockerfile 위치: /Trailog/apps/server/Dockerfile
```

`fly.toml`의 `dockerfile = 'apps/server/Dockerfile'`는 **컨텍스트(루트) 기준 상대 경로**. Dockerfile 안에서 `COPY package.json` 같은 명령이 루트의 파일을 가리킴 → workspace 의존성 처리 가능.

흔한 실수:

- ❌ `dockerfile = '../../apps/server/Dockerfile'` (옛 fly.toml 디렉토리 기준 X)
- ❌ fly.toml을 `apps/server/` 안에 두기 → 빌드 컨텍스트가 `apps/server/`만 되어 루트 workspace 파일 못 가져옴

### 6. Fly Secrets — AWS Secrets Manager 대응

`.env` 파일은 절대 commit X. 런타임 환경변수는 `fly secrets`로:

```bash
# 등록
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set JWT_SECRET="..."

# 조회
fly secrets list

# 삭제
fly secrets unset DATABASE_URL
```

특징:

- 암호화 저장
- 변경 시 자동 재배포
- 머신 안 환경변수로 자동 주입 (`process.env.DATABASE_URL`)
- AWS Secrets Manager 또는 SSM Parameter Store와 동일한 멘탈 모델

## 자주 쓰는 flyctl 명령

| 명령                             | 의미                          |
| -------------------------------- | ----------------------------- |
| `fly deploy`                     | fly.toml 기반으로 빌드 + 배포 |
| `fly status`                     | machine 상태, 헬스체크 결과   |
| `fly logs`                       | 실시간 로그 (tail)            |
| `fly ssh console`                | machine에 SSH 접속            |
| `fly secrets set / list / unset` | 환경변수 관리                 |
| `fly scale count 2`              | machine 개수 변경             |
| `fly scale memory 512`           | 메모리 사이즈 변경            |
| `fly tokens create deploy`       | CI/CD용 API 토큰              |
| `fly apps destroy <name>`        | 완전 삭제 (위험)              |

## GitHub Actions로 자동 배포 흐름

```
main 브랜치에 push (paths-filter로 백엔드 관련 변경만)
       ↓
.github/workflows/deploy.yml 트리거
       ↓
actions/checkout
       ↓
superfly/flyctl-actions/setup-flyctl (flyctl CLI 설치)
       ↓
fly deploy --remote-only
   (FLY_API_TOKEN secret 사용)
       ↓
Fly.io 빌드 서버(remote builder)에서 이미지 빌드
       ↓
도쿄 리전에 새 machine 배포 (rolling)
       ↓
헬스체크 통과 후 트래픽 전환 (zero-downtime)
```

`--remote-only`: 로컬에서 Docker 빌드 X. Fly.io 클라우드 빌드 서버 사용. GitHub Actions runner에서 Docker 빌드 시간/리소스 절약.

## ECS Fargate와의 매핑 (Phase 4 마이그레이션 미리보기)

| 개념          | Fly.io                            | AWS ECS Fargate                   |
| ------------- | --------------------------------- | --------------------------------- |
| 배포 단위     | Fly App                           | ECS Service                       |
| 실행 단위     | Machine (micro-VM)                | Task                              |
| 컨테이너 정의 | Dockerfile                        | Dockerfile                        |
| 이미지 저장소 | Fly registry (내장)               | ECR                               |
| 시크릿        | `fly secrets`                     | Secrets Manager / Parameter Store |
| 헬스체크      | `[[http_service.checks]]`         | Target Group health check         |
| 로드밸런서    | 자동 (Fly proxy)                  | ALB                               |
| 로그          | `fly logs`                        | CloudWatch Logs                   |
| 자동 스케일   | `auto_stop_machines` + auto_start | ECS Service Auto Scaling          |
| CLI           | `flyctl`                          | `aws ecs`                         |
| IaC           | fly.toml                          | Terraform / CDK                   |

→ **Phase 4에 옮길 때 멘탈 모델 그대로 사용 가능**. 도구만 바뀌고 개념은 같음.

## 흔한 함정 / 주의할 점

1. **app name unique 충돌** — `trailog-server`는 흔해서 이미 사용 중일 수 있음. `fly apps create` 시점에 확인.
2. **`fly deploy` 전에 app 등록 필수** — `fly apps create` 또는 `fly launch` 먼저. 없으면 "app not found" 에러.
3. **빌드 컨텍스트 = fly.toml 위치** — 모노레포에선 fly.toml을 루트에 둬야 workspace 파일 접근 가능.
4. **`fly secrets`로 등록한 값은 fly.toml에 적지 말 것** — 자동 주입됨. 중복하면 충돌.
5. **헬스체크 grace_period 짧으면 첫 부팅 실패** — NestJS 부팅이 5초+ 걸리면 grace_period를 15~30초로.
6. **첫 배포는 2 machines 자동 생성** (high availability) — `auto_stop_machines` + `min_machines_running = 0` 조합이면 트래픽 없을 때 비용 0.
7. **신용카드 등록 필수** (2024 정책) — 무료 한도 안에선 청구 0. spend limit 설정 안전.
8. **`--remote-only` 안 쓰면 로컬 Docker 필수** — GitHub Actions runner에 Docker 있긴 하지만 빌드 시간 ↑. remote 권장.

## 비용 모니터링

- 대시보드 → Billing → Usage
- spend limit 설정 권장 ($5/월 안전 cap)
- 사이드 트래픽 미미: hobby plan 무료 한도 안에서 운영 (~$0/월)
- 만약 트래픽 늘면: `auto_stop_machines` 활용 + 메모리/CPU 사이즈 조정

무료 한도 (2026 기준):

- 3개 shared-cpu-1x VM (256MB RAM 각각)
- 3GB persistent volume
- 160GB/월 outbound

→ 우리 셋업은 한도 내 100% 안에 있음.

## 더 파볼 거리 (선택)

- **Multi-stage Dockerfile 최적화** — pnpm 모노레포에서 production deps만 분리하는 정교한 패턴
- **`fly deploy --strategy bluegreen`** — 무중단 배포 전략 (canary/rolling/bluegreen 비교)
- **Volume mount** — Phase 2 사진 업로드 시 (단 우리는 R2로 외부화 예정)
- **Custom domain + ACM TLS** — `fly certs add trailog.app` (Phase 4쯤)
- **Fly Metrics + Grafana** — 외부 모니터링 통합
- **Multi-region deploy** — `fly regions add ams sin` (글로벌 사용자 가정)
- **`fly machine clone`** — 디버깅용 머신 복제
- **`fly proxy` + 로컬 DB 접근** — production DB에 로컬 psql

## 실무 환경과의 비교

- 실무는 AWS ECS Fargate 직접 운영 (Fly.io 안 씀)
- 단 **Dockerfile + 시크릿 + 헬스체크 + 자동 스케일** 멘탈 모델은 동일
- 본인이 Fly.io로 익힌 모든 게 Phase 4 ECS 마이그레이션 시 그대로 활용
- 학습 토픽 토픽: "PaaS로 시작해 운영 안정화 후 AWS ECS로 마이그레이션" — 강력한 실무 진화 스토리

## 참고 링크

- [Fly.io 공식](https://fly.io/docs/)
- [Fly.io NestJS 가이드](https://fly.io/docs/js/frameworks/nestjs/)
- [Fly.io monorepo 가이드](https://fly.io/docs/launch/monorepo/)
- [flyctl reference](https://fly.io/docs/flyctl/)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- 관련 ADR: [ADR-0002](../decisions/0002-hybrid-infra-paas-then-aws-ecs.md), [ADR-0004](../decisions/0004-paas-tool-flyio.md)
- 관련 코드: `apps/server/Dockerfile`, `fly.toml`, `.dockerignore`, `.github/workflows/deploy.yml`

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
