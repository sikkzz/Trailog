# 운영 백엔드 인프라 진화 4단계 + 개념 사전

> **작성일**: 2026-05-23
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라 / DevOps (1순위)
> **관련 문서**: [Docker 기초 + 실무 백엔드 패턴](./docker-basics-and-real-world-backend.md), [Phase 1 Spec](../specs/phase-01-bootstrap.md)

---

## 한 줄 요약

운영 백엔드는 한 번에 만들어지지 않고 **"단순함 → 비즈니스 성장 → 문제 발생 → 해결 → 새 요구사항 → 고도화"** 사이클을 거치며 진화한다. 각 단계 결정은 그 시점엔 합리적이었고, 다음 단계로 넘어간 이유는 "예전 방식이 더는 못 버틸 만큼 문제가 쌓여서". 본인이 분석한 실무 B2B SaaS 사례를 일반화한 4단계 진화 분석 + 등장 개념 사전 + Trailog 방향성 매핑.

---

# Part 1. 운영 백엔드 인프라 진화 — 일반 4단계

## 단계 1: 단일 서버 (EC2 + 프로세스 매니저)

### 구성

```
[사용자] → [단일 EC2 (Linux VM 1대)]
              └── Node.js 백엔드 (PM2로 프로세스 관리)
              └── CodeDeploy 자동 배포
              └── Whatap / NewRelic 같은 상용 APM
```

### 왜 이 시점에 합리적이었나

- **사용자 수 적음** — 단일 서버로 충분
- **인프라 복잡도 ≤ 비즈니스 가치** — 과한 설계는 낭비
- **개발 속도 우선** — 빠르게 출시 + 학습
- PROJECT_ROOT 8장 안티패턴 5번("유저 0명일 때 스케일 걱정 X")의 살아있는 적용

### 왜 못 버텼나 (다음 단계로 넘어간 이유)

- B2B 사업이라 **고객사가 늘기 시작** → 데이터 격리 / 커스터마이징 필요
- 단일 서버에 다 모으면 **장애 격리 안 됨** (A 고객사 문제가 B로 번짐)
- 비용 청구 분리 어려움

### Trailog 적용도

- ⭐ 우리도 **유사한 출발점** — 단일 백엔드 NestJS
- 단 EC2 대신 PaaS(Railway/Fly.io) 사용 → 컨테이너 기반이라 다음 단계 진화 더 부드러움
- B2B 아니라 단일 사용자 위주 → 멀티테넌트 단계 자체를 건너뜀

---

## 단계 2: 고객사별 인프라 분리 (멀티테넌트 초기 패턴)

### 구성

```
[고객사 A 사용자] → [EC2-A] + 별도 파이프라인 A
[고객사 B 사용자] → [EC2-B] + 별도 파이프라인 B
[고객사 C 사용자] → [EC2-C] + 별도 파이프라인 C
```

각 고객사가 자기만의 인프라 + 배포 흐름.

### 왜 이 시점에 합리적이었나

- **가장 단순한 격리 방식** — 인프라 자체를 분리하면 데이터/장애가 자연스럽게 격리됨
- **고객사별 커스터마이징** 가능 — 환경변수, 설정 다르게
- **빠른 도입** — 기존 코드 그대로 두고 인프라만 복사

### 왜 못 버텼나 (다음 단계로 넘어간 이유)

- **운영 부담 폭증** — 고객사 N개면 EC2 N개 + 파이프라인 N개. 신규 고객사 추가가 점점 무거워짐
- **무중단 배포 어려움** — EC2에 새 코드 올리면 잠시 끊김 (사용자 영향)
- **수동 스케일링** — 트래픽 급증 시 손으로 EC2 추가. 새벽에 비상
- **비용 비효율** — 트래픽 적은 시간대도 EC2가 그대로 떠 있음
- **표준화 어려움** — 고객사마다 다른 설정이 누적되며 운영 복잡도 폭발

### 멀티테넌트의 3가지 패턴

이 단계는 **가장 격리도 강하지만 가장 비싼** 패턴. 다른 패턴도 알아둘 가치:

| 방식                        | 분리 단위              | 비용    | 격리도                     | 추천 시점                          |
| --------------------------- | ---------------------- | ------- | -------------------------- | ---------------------------------- |
| **인프라 분리**             | 서버/DB 통째로         | 비쌈    | 매우 강함                  | 고객사 적고 보안 요구 매우 강할 때 |
| **DB 분리**                 | 같은 서버, 다른 DB     | 중간    | 강함                       | 균형형                             |
| **테이블 분리 + tenant_id** | 같은 DB, 컬럼으로 구분 | 가장 쌈 | 약함 (실수 시 데이터 누설) | 고객사 많고 격리 요구 보통         |

### Trailog 적용도

- ❌ **건너뜀** — 사이드는 단일 사용자 위주, B2B 아님
- 단 멀티테넌트 패턴 자체는 학습 가치 있음 (참조 코드 읽을 때 만남)

---

## 단계 3: 컨테이너 통합 (가장 큰 점프)

### 구성

```
[GitHub] → [GitHub Actions CI/CD] → [Docker 이미지 빌드]
                                         ↓
                                    [ECR (이미지 저장소)]
                                         ↓
                                    [ECS Fargate]
                                    ├── 프로덕션 서비스
                                    └── 개발 서비스
                                         ↓
                                    [RDS / ElastiCache / S3 등]
```

EC2 직접 관리 끝. 컨테이너 + 오케스트레이션으로 자동화.

### 왜 이 단계로 점프했나 (단계 2의 문제 해결)

| 단계 2의 문제          | 단계 3의 해결책                                                       |
| ---------------------- | --------------------------------------------------------------------- |
| 고객사별 EC2 운영 부담 | 단일 클러스터, **앱 레벨**에서 멀티테넌트 (DB/컬럼 분리)              |
| 무중단 배포 어려움     | **Rolling Deployment** — 새 컨테이너 띄우고 트래픽 옮긴 후 옛 거 죽임 |
| 수동 스케일링          | **Auto Scaling** — CPU/메모리 임계치 도달 시 자동 컨테이너 추가       |
| 비용 비효율            | **Fargate**: 컨테이너 종료 시 자원 반환, 사용한 만큼만                |
| 표준화 어려움          | 모두 같은 이미지 → 환경 통일                                          |

### 핵심 도구 4가지 (Part 2 개념 사전 참고)

1. **Docker** — 앱 + 의존성 통째로 컨테이너로 패키징
2. **ECS (Elastic Container Service)** — 컨테이너 자동 띄우고 관리
3. **Fargate** — ECS의 launch type. 서버 자체도 AWS가 관리 (서버리스 컨테이너)
4. **GitHub Actions** — 코드 push → 자동 빌드/테스트/배포 (CI/CD)

### 부수 효과 (의도하지 않았던 좋은 점)

- **모든 환경 통일** — 로컬·CI·스테이징·프로덕션이 같은 이미지로 도니까 "내 PC에선 됐는데" 박멸
- **롤백 쉬움** — 이전 이미지 태그로 가리키기만 하면 끝
- **A/B 테스트** — 컨테이너 일부만 새 버전 띄워서 트래픽 일부 받기 (canary)

### 왜 다음 단계로 가야 했나

이 단계는 **운영 안정의 입구**. 다음 단계로의 진화는 "못 버텨서"가 아니라 **새 요구사항 추가** 흐름.

### Trailog 적용도

- ⭐ **Phase 4가 정확히 이 단계의 압축판**
- 단 ECS 대신 Railway/Fly.io 사용 (PaaS도 결국 컨테이너 기반)
- Docker / CI/CD / 무중단 배포 / 자동 스케일링 학습은 동일

---

## 단계 4: 운영 고도화 (CDN, 모니터링, 실시간, AI)

단계 3에서 운영 안정되면 **새 요구사항이 자연스럽게 생김**. 각자 사유 있음.

### 4-1. CDN (Content Delivery Network)

**왜?** 사용자 늘면 정적 파일(이미지, JS, CSS)을 사용자 가까운 곳에서 빠르게 전달 필요.

- **CloudFront** = AWS의 CDN. 전 세계 엣지 서버에 캐시
- **Lambda@Edge** = CDN 엣지에서 가벼운 함수 실행 (예: 한글 파일명 처리, A/B 테스트 로직)

### 4-2. 자체 APM (Application Performance Monitoring)

**왜?** 상용 APM(Whatap, Datadog 등) 비용 vs 직접 만들기 trade-off.

- 상용: 빠른 도입, 풍부한 기능, 비쌈
- 자체: 무료 (개발 비용 + 유지 부담), 자율성, 참조 도메인에 맞춰 커스터마이징
- 큰 기업 / 트래픽 많음 → 자체로 가는 경우 흔함

### 4-3. 이메일 (SES SDK 직접)

**왜?** 알림/인증/마케팅 메일. 라이브러리 추상화 안 거치고 SDK 직접 호출하면 더 빠르고 디버깅 명확.

- **SES** = AWS의 이메일 발송 서비스
- **SDK v3** = AWS SDK 3세대 (TypeScript 친화, 모듈러)

### 4-4. 실시간 통신 (SSE + Presence)

**왜?** "누가 지금 온라인인지", "이벤트 실시간 알림" 같은 기능 추가.

- **SSE (Server-Sent Events)** = 서버 → 클라이언트 **단방향** 실시간 (WebSocket의 가벼운 버전)
- **Presence 시스템** = Redis에 사용자별 마지막 접속 시각 저장, TTL로 자동 만료

### 4-5. AI 통합

**왜?** LLM API 통합. 환경변수에 API 키 안전하게 주입.

- **Secrets Manager** = AWS의 시크릿 관리. 평문 노출 X, 회전 가능
- **Feature Flag** (`ENABLE_AI_*`) = 기능 켜고 끄기 / 단계적 출시

### 4-6. 도메인/CORS 강화

**왜?** 서비스 도메인 늘어남 → 보안 정책 정교화 필요.

- **CORS (Cross-Origin Resource Sharing)** = 브라우저가 "다른 도메인 API 호출해도 됨?" 검사하는 정책
- 도메인 분리 → CORS·쿠키 설정 명확해짐

### Trailog 적용도

- 🟡 Phase 5+에서 부분적 적용 예정
- 실시간 (SSE/WebSocket): Phase 5
- CDN: Cloudflare R2가 이미 Cloudflare 생태계 (자연스러운 연결)
- 자체 APM: ❌ 사이드 규모엔 과함. Sentry 같은 SaaS로
- AI: Phase 6 옵션 A (자체 운영 CLIP)이나 옵션 B (외부 API) 결정

---

# Part 2. 개념 사전

각 개념 한 줄 정의 + 우리 프로젝트 적용 시점/방식.

## 컴퓨트 (Compute)

| 개념                                   | 정의                                                                            | Trailog 적용                     |
| -------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------- |
| **EC2**                                | AWS의 가상 서버 (Linux/Windows VM 1대 빌리기)                                   | ❌ 직접 사용 X                   |
| **ECS (Elastic Container Service)**    | AWS의 컨테이너 오케스트레이션. 컨테이너 자동 관리                               | (보너스 학습) LocalStack 등으로  |
| **Fargate**                            | ECS의 launch type. 서버 자체도 AWS 관리 (서버리스 컨테이너)                     | 학습용                           |
| **EKS (Elastic Kubernetes Service)**   | AWS의 매니지드 Kubernetes                                                       | 사이드엔 과함                    |
| **Kubernetes**                         | 컨테이너 오케스트레이션의 산업 표준. 오픈소스                                   | 사이드엔 과함, 실무 갈 때 학습   |
| **PaaS (Platform as a Service)**       | 인프라 관리 안 하고 코드만 올리면 도는 서비스 (Heroku, Railway, Fly.io, Vercel) | ⭐ Phase 4 (Railway 또는 Fly.io) |
| **IaaS (Infrastructure as a Service)** | 서버/네트워크/스토리지를 빌리는 서비스 (AWS, GCP)                               | 사이드 직접 X                    |
| **PM2**                                | Node.js 프로세스 매니저. 백그라운드 실행 + 죽으면 자동 재시작                   | ❌ 컨테이너 시대엔 거의 안 씀    |

## 배포 (Deployment)

| 개념                            | 정의                                            | Trailog 적용                   |
| ------------------------------- | ----------------------------------------------- | ------------------------------ |
| **CodeDeploy**                  | AWS의 EC2/Lambda 자동 배포 도구                 | ❌                             |
| **CI (Continuous Integration)** | 코드 push마다 자동 빌드/테스트                  | ⭐ Phase 1 (GitHub Actions)    |
| **CD (Continuous Deployment)**  | main 머지마다 자동 배포                         | ⭐ Phase 1 (Railway 자동 배포) |
| **Rolling Deployment**          | 새 인스턴스 점진적 교체. 끊김 없음              | Phase 4                        |
| **Blue/Green Deployment**       | 새 환경 통째로 띄우고 트래픽 한 번에 전환       | 사이드 규모엔 과함             |
| **Canary Deployment**           | 새 버전을 일부 트래픽에만 먼저 노출 (위험 감소) | 사이드 규모엔 과함             |
| **GitHub Actions**              | GitHub의 CI/CD 도구. YAML 워크플로              | ⭐ Phase 1                     |

## DB / 캐시

| 개념                                  | 정의                                                           | Trailog 적용                |
| ------------------------------------- | -------------------------------------------------------------- | --------------------------- |
| **RDS (Relational Database Service)** | AWS의 매니지드 DB 서비스 (MySQL, Postgres 등)                  | ❌ Supabase/Neon 사용       |
| **AZ (Availability Zone)**            | AWS 리전 안의 데이터센터 단위                                  | -                           |
| **Single-AZ**                         | DB가 한 AZ에만 있음. 비용 1배, AZ 장애 시 수분~수십분 다운타임 | (잠정) 무료 티어 Single-AZ  |
| **Multi-AZ**                          | DB가 여러 AZ에 복제. 비용 2배, 자동 fail over                  | 학습 후 옵션                |
| **ElastiCache**                       | AWS의 매니지드 Redis/Memcached                                 | ❌ Upstash 무료 사용        |
| **Connection Pool**                   | DB 연결 미리 만들어두고 재사용                                 | (Phase 2) Prisma 기본 제공  |
| **Migration**                         | DB 스키마 변경을 코드로 관리                                   | ⭐ Prisma migrate (Phase 2) |
| **Outbox Pattern**                    | 비즈니스 로직 트랜잭션 + 이벤트 발행 원자성 보장               | ❌ 모놀리스라 불필요        |

## 네트워크 / CDN

| 개념                                     | 정의                                                   | Trailog 적용                      |
| ---------------------------------------- | ------------------------------------------------------ | --------------------------------- |
| **CDN (Content Delivery Network)**       | 전 세계 엣지 서버 캐시로 빠른 응답                     | Cloudflare (R2 + CDN 통합)        |
| **CloudFront**                           | AWS의 CDN                                              | ❌ Cloudflare 사용                |
| **Lambda@Edge**                          | CloudFront 엣지에서 함수 실행                          | ❌                                |
| **CORS (Cross-Origin Resource Sharing)** | 브라우저가 다른 도메인 API 호출 가능한지 검사하는 정책 | ⭐ Phase 2 (NestJS CORS 설정)     |
| **ALB (Application Load Balancer)**      | AWS의 L7 로드밸런서. 트래픽 분배                       | ❌ PaaS가 알아서 처리             |
| **VPC (Virtual Private Cloud)**          | AWS 안의 가상 네트워크. 격리 단위                      | ❌                                |
| **Route 53**                             | AWS의 DNS 서비스                                       | ❌ Cloudflare Registrar 사용 예정 |

## 메일 / 알림

| 개념                           | 정의                                             | Trailog 적용        |
| ------------------------------ | ------------------------------------------------ | ------------------- |
| **SES (Simple Email Service)** | AWS의 이메일 발송. 저렴, 신뢰성                  | (Phase 4) 옵션      |
| **SES SDK v3**                 | AWS SDK 3세대 (모듈러, TypeScript 친화)          | -                   |
| **nodemailer**                 | Node.js 이메일 라이브러리. 다양한 transport 지원 | (Phase 4) 옵션      |
| **Resend / Postmark**          | 이메일 전용 SaaS. 더 친절한 DX                   | (Phase 4) 검토 옵션 |

## 실시간 통신

| 개념                         | 정의                                              | Trailog 적용    |
| ---------------------------- | ------------------------------------------------- | --------------- |
| **Polling**                  | 클라이언트가 주기적으로 서버에 "새 거 있어?" 묻기 | ❌ 비효율       |
| **Long Polling**             | 서버가 답 줄 거 있을 때까지 응답 미룸             | ❌              |
| **SSE (Server-Sent Events)** | 서버 → 클라이언트 **단방향** 실시간. HTTP 기반    | ⭐ Phase 5 후보 |
| **WebSocket**                | **양방향** 실시간. 채팅 같은 패턴에 필수          | ⭐ Phase 5 후보 |
| **Presence System**          | "누가 온라인인지" 추적. Redis TTL 활용            | ⭐ Phase 5 후보 |

## 보안 / 인증

| 개념                                     | 정의                                       | Trailog 적용               |
| ---------------------------------------- | ------------------------------------------ | -------------------------- |
| **JWT (JSON Web Token)**                 | 토큰 기반 인증. stateless                  | ⭐ Phase 2 (직접 구현)     |
| **OAuth2**                               | 외부 인증 위임 (Google, Kakao 로그인)      | (Phase 2) 옵션             |
| **Refresh Token**                        | JWT 만료 후 재발급용 토큰                  | ⭐ Phase 2                 |
| **Secrets Manager**                      | AWS의 시크릿 관리. 암호화 + 회전           | ❌ Railway/Fly.io env 사용 |
| **Parameter Store**                      | AWS의 설정값 저장. 일부 시크릿도 OK (저렴) | ❌                         |
| **IAM (Identity and Access Management)** | AWS 권한 관리                              | (보너스) 학습              |

## 모니터링 / 관측

| 개념                                         | 정의                                            | Trailog 적용        |
| -------------------------------------------- | ----------------------------------------------- | ------------------- |
| **APM (Application Performance Monitoring)** | 앱 성능·에러·요청 추적                          | ⭐ Phase 4 (Sentry) |
| **CloudWatch**                               | AWS의 로그·메트릭 통합. Logs / Metrics / Alarms | ❌                  |
| **Sentry**                                   | 에러 추적 + 일부 APM. 무료 티어 풍부            | ⭐ Phase 4          |
| **Datadog**                                  | 종합 모니터링 SaaS. 비쌈                        | 사이드엔 과함       |
| **구조화 로깅 (Structured Logging)**         | JSON 형태 로그. 검색·필터링 쉬움                | ⭐ Phase 4          |

---

# Part 3. Trailog 방향성 매핑

## 현재 위치 (Phase 1 진행 중)

**단계 0~1 사이** — 로컬 Docker Compose만, 클라우드 X.

- ✅ pnpm + Turborepo 모노레포
- ✅ NestJS + `/health` 엔드포인트
- ✅ ESLint + Prettier
- ✅ 로컬 Postgres + Redis (Docker Compose)
- ⏳ GitHub Actions CI (Phase 1 4.3)
- ⏳ PaaS 배포 (Phase 1 4.4)
- ⏳ EAS 모바일 빌드 (Phase 1 4.5)

## Phase별 매핑

| Phase       | 우리가 하는 것                                                                                                                  | 실무 인프라 진화 단계         | 비고                                           |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------- |
| **Phase 1** | pnpm 모노레포, NestJS 부트스트랩, Docker Compose 로컬, PaaS 첫 배포, EAS dev build                                              | 단계 1 압축판 + 단계 3 시작점 | PaaS도 컨테이너 기반이라 단계 3 개념 자연 학습 |
| **Phase 2** | 사진 업로드 (presigned URL → R2), DB 모델링, JWT 인증, 백그라운드 워커                                                          | 단계 1 확장                   | 도메인 기능 + 큐(BullMQ)/이미지 파이프라인     |
| **Phase 3** | 지도/시각화, 클러스터링, 타임라인                                                                                               | 단계 1 계속                   | 프론트엔드 중심, 인프라 변화 적음              |
| **Phase 4** | 운영 안정화 + **AWS ECS Fargate 마이그레이션** (ADR-0002), Sentry, IaC(Terraform 선택), CloudWatch, TestFlight/Play 내부 테스트 | 단계 3 본격 + 단계 4 초입     | **PaaS → AWS 직접 운영으로 격상**              |
| **Phase 5** | 실시간 (SSE/WebSocket), Redis 캐싱, Presence (AWS ECS 위에서)                                                                   | 단계 4의 실시간 부분          | 참조 패턴 그대로 참고 가능                     |
| **Phase 6** | (옵션 A) AI 통합 또는 (옵션 B) SNS 확장                                                                                         | 단계 4의 AI 부분              | LLM API vs 자체 모델 결정                      |

## 의도적으로 건너뛰는 것들

이건 실무가 거쳤지만 우리는 의식적으로 안 가는 영역:

| 건너뛰는 것                         | 이유                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------ |
| **단계 2 (고객사별 인프라 분리)**   | 사이드는 멀티테넌트 X. 단일 사용자 위주                                  |
| **자체 APM 만들기**                 | Sentry SaaS로 충분. 인프라 학습 1순위지만 APM 자체 제작은 너무 깊음      |
| **CloudFront + Lambda@Edge**        | Cloudflare R2가 이미 CDN 포함. AWS CDN 학습은 별도                       |
| **Multi-AZ DB**                     | 학습 단계엔 무료 티어 Single-AZ로. 안정성보다 학습 우선                  |
| **단계 2~3을 처음부터**             | PaaS로 압축 출시 후 Phase 4에 AWS ECS 마이그레이션 (ADR-0002 하이브리드) |
| **VPC/IAM 풀세트**                  | Phase 4 진입 시 간소 셋업 (단일 AZ + Public subnet). 풀세트는 실무 가서  |
| **마이크로서비스 + Outbox Pattern** | 모놀리스로 시작 (PROJECT_ROOT 8장 안티패턴 3)                            |
| **Multi-AZ DB**                     | 학습 단계엔 무료/저티어 Single-AZ로. 비용 ↓ 우선                         |
| **자체 APM 만들기**                 | Sentry SaaS로 충분. APM 자체 제작은 깊은 학습 영역                       |
| **CloudFront + Lambda@Edge**        | Cloudflare R2가 이미 CDN 포함. AWS CDN은 별도 학습                       |

## 왜 하이브리드인가 (ADR-0002 압축)

본 프로젝트는 **Phase 1~3 PaaS, Phase 4에 AWS ECS Fargate 마이그레이션** 채택. 자세한 사유는 [ADR-0002](../decisions/0002-hybrid-infra-paas-then-aws-ecs.md).

### 4가지 핵심 사유

1. **시간 분배 균형**
   - Phase 1~3: PaaS로 본진(이미지/지도/모바일) 가속. 인프라 시간 최소화.
   - Phase 4: 인프라 한 번에 본격 학습. 깊이 있는 hands-on.

2. **실무 학습 시그널 강화**
   - 백엔드/인프라 채용 공고 80~90%에 AWS 명시
   - PaaS만 다뤘으면 "그게 자동화돼서 인프라 못 만진다" 인식
   - AWS ECS·Terraform·ECR·CloudWatch 직접 운영 경험 = 강한 시그널

3. **실무 학습 직결**
   - 실무 환경가 ECS Fargate + Terraform 운영
   - 사이드 학습이 참조 코드 이해·동료 대화에 즉시 활용
   - 실무 단계 1 → 3 마이그레이션을 Trailog로 재현 ⇒ 학습 토픽 토픽

4. **비용 통제 + 학습 가치**
   - Phase 1~3 PaaS: $0~10/월
   - Phase 4 ECS Fargate (최소 사양): $30~50/월 — 학습 비용으로 받아들일 만함
   - CloudWatch Billing Alarm 필수

### 학습 사이클 (실무 진화 vs Trailog 매핑)

```
[실무 진화]              [Trailog Phase]      [학습 의도]
2024 초~중               (Phase 1~3 압축)     본진 가속, 컨테이너 개념
EC2 + PM2                PaaS (Railway/Fly)   PaaS도 컨테이너 기반
   ↓                        ↓
2024-10 ~ 2025-02        (건너뜀)             멀티테넌트는 사이드엔 X
고객사별 EC2
   ↓                        ↓
2026 Q1 ★               Phase 4 ★            본격 인프라 학습
ECS Fargate 마이그레이션   AWS 마이그레이션      마이그레이션 스토리 확보
   ↓                        ↓
2026 Q2~                Phase 5+             실시간/캐싱/AI
운영 고도화                 부분 적용             참조 패턴 참고
```

## 본인 학습 관점 정리

**1. "실무 = 큰 학습 자산 + Trailog는 실무 진화의 재현"**

- 단계 3~4의 advanced 패턴은 사이드에서 직접 만들지 않음
- 참조 코드/문서 읽기 + Phase 4 마이그레이션 hands-on = 양쪽 보강

**2. "Trailog 학습의 합목적성"**

- Phase 1~3 = PaaS로 본진 가속 (학습 영역 2/3/6 충족)
- **Phase 4 = 인프라 본격 (학습 영역 1번 + AWS 실무 경험)**
- Phase 5+ = 실무 단계 4의 일부. 실시간/캐싱 직접 구현

**3. "Anti-pattern 피하기 = 진화 사이클 존중"**

- 처음부터 ECS/마이크로서비스/Multi-AZ 다 깔지 않음
- 실무도 그렇게 안 했음 (2024~2026, 2년에 걸친 진화)
- 우리도 Phase 1~3 PaaS → Phase 4 ECS 단계적 진화

**4. "마이그레이션 자체가 학습"**

- "왜 PaaS에서 AWS로 옮겼나" = 실무가 EC2→ECS 옮긴 사유와 거의 같음
- 학습 토픽에서 풀어낼 수 있는 강한 토픽 (트래픽, 비용, 운영 부담 trade-off)

---

## 흔한 함정 / 주의할 점

1. **"운영처럼 만들고 싶다" 충동** — 사이드는 학습 목적. 단계 1~2 건너뛰고 단계 4 흉내 내면 만들다가 지침.
2. **"실무가 ECS 쓰니까 사이드도 처음부터 ECS"** — 시점이 중요. **Phase 1~3엔 PaaS, Phase 4에 ECS**가 학습 합목적성 (ADR-0002). 처음부터 ECS는 학습 영역 6개 균형 깸.
3. **"개념 사전 다 외워야 함" 부담** — 외울 필요 X. 만나는 시점마다 개념 사전 다시 보면 됨.
4. **"단계 진화는 정해진 순서다" 오해** — 절대 아님. 시작부터 ECS 쓸 수도 있고, EC2로 영원히 갈 수도 있음. **그 시점의 trade-off 판단**이 핵심.

## 더 파볼 거리 (선택)

- **각 단계 사이의 데이터 마이그레이션** — EC2 → ECS 옮길 때 DB는? 다운타임은?
- **참조 패턴의 Cost analysis** — 단계 4의 SES/CloudFront/CloudWatch 비용 구조
- **Multi-AZ → Active-Active 옵션** — Aurora Global Database 같은 advanced
- **Service Mesh (Istio, Linkerd)** — 마이크로서비스 트래픽 관리. Kubernetes 시대 산물
- **Observability 3 pillars** — Logs, Metrics, Traces (OpenTelemetry)

## 참고 링크

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/) — 인프라 설계 5 pillars (보안, 신뢰성, 성능, 비용, 운영)
- [Twelve-Factor App](https://12factor.net/) — 컨테이너 친화 백엔드 설계 원칙
- [Martin Fowler — Microservices](https://martinfowler.com/articles/microservices.html) — 마이크로서비스 정의·언제 필요한가
- 관련 노트: [Docker 기초 + 실무 백엔드 패턴](./docker-basics-and-real-world-backend.md), [Docker Compose 기초](./docker-compose-essentials.md)
- 관련 ADR: [ADR-0002 하이브리드 인프라 전략](../decisions/0002-hybrid-infra-paas-then-aws-ecs.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
