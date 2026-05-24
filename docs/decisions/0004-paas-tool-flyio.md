# ADR-0004: PaaS 도구 — Fly.io 채택

> **상태**: ✅ Accepted (확정 2026-05-24)
> **날짜**: 2026-05-24
> **결정자**: @sikkzz (제안: Claude)
> **관련 문서**: [ADR-0002 하이브리드 인프라](./0002-hybrid-infra-paas-then-aws-ecs.md), [Phase 1 Spec](../specs/phase-01-bootstrap.md)

---

## 맥락 (Context)

[ADR-0002](./0002-hybrid-infra-paas-then-aws-ecs.md)에서 결정:

> Phase 1~3: PaaS (Railway 또는 Fly.io) → Phase 4에 AWS ECS Fargate 마이그레이션

본 ADR은 그 PaaS 도구를 **Railway 또는 Fly.io 중 어느 쪽** 정식 결정. Phase 1 4.4 (백엔드 배포) 직전 작성.

## 결정 (Decision)

**선택**: ✅ **Fly.io** (hobby plan)

세부:

- `apps/server` 백엔드를 Fly.io에 배포
- Region: `nrt` (도쿄) — 한국에서 가장 가까운 리전
- 무료 hobby tier로 시작 (사이드 트래픽 미미)
- Dockerfile 기반 배포 (multi-stage build)
- GitHub Actions로 main 머지 시 자동 deploy
- 환경변수는 `fly secrets`로 안전 주입

## 비교 (Railway vs Fly.io)

| 항목                   | Railway                             | Fly.io                          |
| ---------------------- | ----------------------------------- | ------------------------------- |
| 출발 시점              | 2020                                | 2017                            |
| 시장 포지션            | 모던 Heroku 대안                    | 글로벌 엣지 PaaS                |
| 무료 티어              | $5 크레딧/월 (사용량별)             | hobby plan 무료 (소형 VM)       |
| 셋업 방식              | git 연결 → Nixpacks 자동 빌드       | flyctl CLI + Dockerfile         |
| **컨테이너 노출 수준** | 추상화 (사용자 안 만짐)             | **Dockerfile 직접 작성**        |
| DB 통합                | 같은 프로젝트에 Postgres/Redis 즉시 | Fly Postgres 별도 (관리 dev DB) |
| 글로벌 배포            | 단일 리전                           | **다중 리전 엣지**              |
| 헬스체크/모니터링      | 대시보드 친화                       | 더 깊이 있음 (Fly Metrics)      |
| 시크릿 관리            | 대시보드 UI                         | `fly secrets set` CLI           |
| 학습 곡선              | 매우 낮음                           | 중간                            |
| 시장 인지도            | 모던, 빠른 성장                     | 인프라 진영 인기, AWS-like 경험 |

## 이유 / 트레이드오프

### 왜 Fly.io인가

#### 1. **Phase 4 AWS ECS 마이그레이션의 자연스러운 워밍업** ⭐

ADR-0002에 따라 Phase 4에서 AWS ECS Fargate로 옮길 예정. Fly.io는 ECS와 90% 공통 개념:

| 개념          | Fly.io                          | AWS ECS Fargate                   |
| ------------- | ------------------------------- | --------------------------------- |
| 컨테이너 정의 | Dockerfile                      | Dockerfile                        |
| 이미지 저장소 | Fly registry (내장)             | ECR                               |
| 배포 단위     | Fly App (Machines)              | ECS Service (Tasks)               |
| 리전          | `primary_region`, `fly regions` | AWS region/AZ                     |
| 시크릿        | `fly secrets set`               | Secrets Manager / Parameter Store |
| 헬스체크      | `[http_service]` 설정           | Target Group                      |
| 자동 스케일   | `fly scale`                     | ECS Service Auto Scaling          |
| 로그          | `fly logs`                      | CloudWatch Logs                   |
| CLI           | `flyctl`                        | `aws ecs`                         |

→ **Fly.io에서 익힌 모든 개념이 Phase 4 ECS에 그대로 전이**. Railway는 너무 추상화돼서 그 학습이 단절됨.

#### 2. **학습 영역 1번 (인프라/DevOps) 본격 충족**

Railway는 `git push`만 하면 알아서 도는 마법 같은 도구. 학습 가치는 작음.
Fly.io는 직접 만져야 할 게 많음:

- Multi-stage Dockerfile 작성
- `.dockerignore` 정리
- `fly.toml` 설정
- secrets 분리
- 헬스체크 설정
- region 선택

이 모든 게 학습 영역 1번에 직접 들어감.

#### 3. **무료 티어 충분**

Fly.io hobby plan:

- 3개 shared-cpu-1x VM (256MB RAM 각각)
- 3GB persistent volume
- 160GB/월 outbound 트래픽
- → 사이드 트래픽 미미 (월 수십 명 가정)이라 무료 안에서 충분

비용 알람:

- 대시보드에서 사용량 모니터링
- 신용카드 등록 필수 (2024 정책), 단 무료 한도 안에선 청구 0
- $5/월 spend limit 설정 가능 (안전망)

#### 4. **실무 환경 일치는 약하지만, Phase 4 일치가 더 큰 가치**

- 실무는 AWS ECS 직접 사용 (Railway/Fly.io 안 씀)
- 사이드 PaaS가 실무 환경과 일치할 필요 X
- 중요한 건 Phase 4 마이그레이션을 위한 워밍업 → Fly.io가 답

### 얻는 것

- **Dockerfile + 컨테이너 운영** 첫 본격 경험
- **시크릿 관리 패턴** (`fly secrets` ≈ AWS Secrets Manager)
- **리전/배포 단위** 개념
- **flyctl CLI** — AWS CLI와 유사한 멘탈 모델
- **GitHub Actions → PaaS 배포 파이프라인** 학습
- **Phase 4 마이그레이션 부담 ↓**

### 포기하는 것

- **셋업 시간**: Railway 대비 +30~60분
- **단순함**: Dockerfile 작성 부담
- **다중 리전 자동 활용** (필요할 정도로 트래픽 X)
- **DB 통합 친화도**: Fly Postgres 보다 Supabase/Neon이 더 일반적

### 학습 가치 관점

- 학습 영역 1번 (인프라/DevOps) 매우 큼
- Phase 4 ECS 학습 부담 분산
- 학습 토픽 시그널: "PaaS → ECS 마이그레이션 경험" 풀어낼 수 있는 토픽 풍부

## 검토한 대안

| 대안                | 장점                                       | 단점                                       | 제외 이유              |
| ------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------- |
| **A. Fly.io** ⭐    | Dockerfile + 리전 + 시크릿 = ECS 직결 학습 | 셋업 +30~60분                              | (선택안)               |
| B. Railway          | 가장 빠른 출시, UI 친화                    | Phase 4 학습과 단절, 너무 추상             | 학습 가치 ↓            |
| C. Render           | Heroku 대안, 무료 hobby                    | 일부 무료 한도 빡빡 (sleep)                | 차별성 약함            |
| D. Vercel           | 프론트 친화                                | NestJS 백엔드 잘 안 맞음 (서버리스 함수만) | 백엔드용 아님          |
| E. Heroku           | 1세대 PaaS, 풍부                           | 2022 가격 인상 + 무료 폐지                 | 비추                   |
| F. AWS ECS 처음부터 | Phase 4 학습을 즉시                        | Phase 1 시간 폭증, 비용 폭탄 위험          | ADR-0002에서 이미 제외 |

## 결과 / 영향

### 파일 변경

- `apps/server/Dockerfile` (신규) — multi-stage, production용
- `apps/server/.dockerignore` (신규) — node_modules, dist, .env 제외
- `apps/server/fly.toml` (신규) — Fly.io 배포 설정
- `.github/workflows/deploy.yml` (신규) — main 머지 시 자동 deploy
- `docs/learnings/fly-deployment-and-dockerfile.md` (신규) — 학습 노트
- `docs/PROJECT_ROOT.md`: 4장 백엔드 호스팅 (Phase 1~3) 확정 + 11장 변경 이력
- `docs/specs/phase-01-bootstrap.md`: Q2 해결, 4.4 백엔드 배포 진행

### 운영 영향

- 첫 배포 후 공개 URL 발급 (예: `trailog-server.fly.dev`)
- `/health` 가 공개 URL로 200 반환 → Phase 1 spec 4.4 충족
- main 머지 시 자동 deploy 활성
- 환경변수는 `fly secrets`로 관리 (`.env` commit 금지 유지)

### 비용 모니터링

- Fly.io 대시보드 → Usage 확인
- spend limit $5/월 설정 (안전망)
- 실제 사이드 트래픽엔 무료 한도 안에서 운영 예상

### Phase 4 마이그레이션 시점에 회수할 자산

- Multi-stage Dockerfile (ECS에 그대로 사용 가능)
- secrets 관리 패턴
- GitHub Actions 배포 워크플로 (ECR + ECS push로 수정)
- 모니터링/로그 패턴

## 재검토 트리거

다음 중 하나라도 발생하면 이 결정을 재검토:

- **무료 한도 초과 임박** + 비용 부담 큼 → Railway/Render 검토 또는 Phase 4 마이그레이션 가속
- **Fly.io 서비스 안정성 이슈** (히스토리상 가끔 글로벌 장애) → 대안 검토
- **본인이 Phase 4를 더 빨리 가고 싶음** → ECS로 점프
- **Fly.io 가격 정책 큰 변경**

## 후속 작업

- [ ] flyctl 설치 (`brew install flyctl`)
- [ ] `fly auth signup` + 신용카드 등록 + spend limit 설정
- [ ] `apps/server/Dockerfile` 작성 (multi-stage)
- [ ] `apps/server/.dockerignore` 작성
- [ ] `apps/server/fly.toml` 작성
- [ ] 로컬 `docker build` 검증
- [ ] `fly launch` 또는 `fly deploy` 첫 배포
- [ ] 공개 URL에서 `/health` 200 확인
- [ ] `.github/workflows/deploy.yml` 작성 + `FLY_API_TOKEN` GitHub secret 등록
- [ ] PROJECT_ROOT 4장 + 11장 + Phase 1 spec Q2 업데이트
- [ ] 학습 노트 작성

## 참고

- [Fly.io 공식 docs](https://fly.io/docs/)
- [Fly.io NestJS 가이드](https://fly.io/docs/js/frameworks/nestjs/)
- [Fly.io pricing](https://fly.io/docs/about/pricing/)
- [Dockerfile multi-stage build (공식)](https://docs.docker.com/build/building/multi-stage/)
- 관련 ADR: [ADR-0002 하이브리드 인프라](./0002-hybrid-infra-paas-then-aws-ecs.md)
