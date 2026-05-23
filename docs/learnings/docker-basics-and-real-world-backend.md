# Docker 기초 + 실무 백엔드 패턴 (학습 사이드와의 비교)

> **작성일**: 2026-05-23
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라 / DevOps (1순위)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md), [Docker Compose 노트](./docker-compose-essentials.md)

---

## 한 줄 요약

**Docker** = 프로그램과 그 실행 환경을 통째로 격리된 단위로 묶어 어디서든 똑같이 돌리는 도구.
**ECS** = AWS가 그 컨테이너들을 자동으로 띄우고 분배·재시작하는 오케스트레이션 서비스.
실무 백엔드는 보통 NestJS/Spring + RDB + Redis + Docker + ECS/k8s 조합으로 마이크로서비스 또는 모놀리스로 운영됨.

## 우리 프로젝트에서 어디에 쓰이는가

- Phase 1: `docker/compose.yml` 로 Postgres + Redis 로컬 컨테이너
- Phase 4: 백엔드용 `Dockerfile` 작성, 이미지 빌드 → Railway/Fly.io 배포
- (보너스 학습) AWS LocalStack 또는 무료 티어에서 ECS 흐름 체험

---

## Part 1: Docker 기초

### 1.1 컨테이너가 뭐냐

**비유: 포장 완료된 도시락**

```
일반 프로그램:                       Docker 컨테이너:
[프로그램 코드]                      [프로그램 + 라이브러리 + 시스템 파일 + 설정
       ↓                                 = 자급자족 도시락]
[내 PC의 환경에 의존]                       ↓
                                     [어느 PC든 도시락만 풀면 똑같이 동작]
```

컨테이너 = 격리된 환경에서 도는 프로세스. 자기만의 파일 시스템·네트워크·프로세스 공간을 가지지만, 호스트 OS의 **커널을 공유**해서 가볍게 동작.

### 1.2 VM(가상머신)과의 차이

| 항목              | VM                       | 컨테이너                  |
| ----------------- | ------------------------ | ------------------------- |
| 격리 방식         | OS 통째로                | 프로세스 격리 (커널 공유) |
| 크기              | 수십 GB                  | 수십 MB                   |
| 부팅 시간         | 수십 초                  | 1초 이내                  |
| 한 머신에 띄울 수 | 한 자릿수                | 수십~수백 개              |
| 격리도            | 매우 강함                | 강함 (VM보단 약함)        |
| 비유              | "건물 안에 따로 집 짓기" | "한 집 안에서 방 격리"    |

### 1.3 이미지 vs 컨테이너 (가장 헷갈리는 한 쌍)

| 개념         | 비유                     | 의미                                       |
| ------------ | ------------------------ | ------------------------------------------ |
| **이미지**   | 클래스 / 설계도 / 레시피 | **읽기 전용** 템플릿. 디스크에 가만히 있음 |
| **컨테이너** | 인스턴스 / 실행체        | 이미지에서 만든 실행 중인 프로세스         |

같은 이미지 하나로 컨테이너 여러 개 만들 수 있음:

```
postgis/postgis:16-3.4 (이미지)
        ↓ docker run / docker compose up
        ├─ trailog-postgres   (컨테이너 1)
        ├─ another-postgres   (컨테이너 2)
        └─ test-postgres      (컨테이너 3)
```

### 1.4 이미지는 어디서 오나 — Docker Hub

**Docker Hub** = npm/PyPI 같은 이미지 공식 저장소. https://hub.docker.com

이미지 이름 구조:

```
postgis/postgis:16-3.4
└──┬──┘ └──┬──┘ └─┬─┘
사용자/조직  이미지  태그(버전)
            이름     없으면 latest
```

### 1.5 직접 이미지 만들기 — Dockerfile (Phase 4에서 본격)

```dockerfile
# 예시 (NestJS 백엔드)
FROM node:20-alpine AS builder       # 베이스 이미지부터 시작
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:20-alpine                  # production stage (작게)
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main"]
```

- **Multi-stage build** = 빌드 단계와 실행 단계 분리해서 production 이미지 크기 줄임
- 각 `RUN`, `COPY`가 **레이어**를 만들고 캐시됨 → 변경 없는 부분은 재빌드 안 됨

### 1.6 외울 가치 있는 명령 5개

| 명령                             | 의미                                      |
| -------------------------------- | ----------------------------------------- |
| `docker ps`                      | 실행 중인 컨테이너 (`-a`로 중지된 것까지) |
| `docker images`                  | 받은 이미지 목록                          |
| `docker logs CONTAINER`          | 컨테이너 로그 (`-f`로 실시간)             |
| `docker exec -it CONTAINER bash` | 컨테이너 안에 들어가서 명령 실행          |
| `docker compose up -d / down`    | 우리가 매일 쓰는 거                       |

---

## Part 2: AWS ECS — Docker가 운영에서 어떻게 도는가

### 2.1 EC2 vs ECS

| 항목         | EC2 (Elastic Compute Cloud) | ECS (Elastic Container Service)             |
| ------------ | --------------------------- | ------------------------------------------- |
| 비유         | "AWS에서 빌린 가상 서버"    | "그 서버들 위에 컨테이너 자동 배치/관리"    |
| 무엇         | Linux/Windows VM 인스턴스   | 컨테이너 오케스트레이션                     |
| 배포 단위    | SSH로 코드 직접 올림        | **Docker 이미지** push → ECS가 알아서 띄움  |
| Docker 사용? | ❌ 굳이 안 씀               | ✅ 필수 (ECS의 일거리 자체가 컨테이너 운영) |

**조직이 EC2 → ECS로 옮겼다** = "서버에 직접 코드 올리던 방식에서, Docker 이미지로 빌드해서 AWS에 배포하는 방식으로 전환"이라는 큰 인프라 마이그레이션.

### 2.2 Docker ↔ ECS 전체 흐름

```
[개발자 머신]
   Dockerfile → docker build → Docker 이미지
                                      ↓
                              ECR (AWS의 이미지 저장소) 에 push
                                      ↓
                              ECS Task Definition 업데이트
                                      ↓
                              ECS Service 가 새 이미지로 컨테이너 띄움
                                      ↓
                              여러 EC2/Fargate 머신 위에 분산 배치
                              헬스체크 통과 후 ALB가 트래픽 라우팅
                              죽으면 자동 재시작, 트래픽 늘면 자동 스케일
```

핵심 AWS 서비스 짝궁:

- **ECR (Elastic Container Registry)** = AWS판 Docker Hub. 내 이미지 보관
- **ECS** = 컨테이너 띄우고 관리
- **Fargate** = ECS의 launch type. 서버 자체도 AWS가 관리 (서버리스 컨테이너)
- **ALB** = Application Load Balancer. 컨테이너들 앞에서 트래픽 분배
- **CloudWatch** = 로그·메트릭 수집

### 2.3 ECS vs Kubernetes

| 항목       | ECS                  | Kubernetes (EKS)                |
| ---------- | -------------------- | ------------------------------- |
| 제공       | AWS 전용             | 오픈소스, 모든 클라우드         |
| 학습 곡선  | 낮음                 | 가파름                          |
| AWS 친화도 | 매우 높음            | 중간 (EKS로 통합 가능)          |
| 시장 인기  | AWS 환경에선 흔함    | 산업 전체 표준                  |
| 추천 시점  | AWS only + 빠른 도입 | 멀티 클라우드 + 복잡한 워크로드 |

조직마다 선택 다름. 둘 다 Docker 위에서 동작한다는 점은 같음.

---

## Part 3: 실무 백엔드 패턴 vs 학습 사이드 — 무엇이 다르고 왜

> 본인이 분석한 실무 NestJS 백엔드 사례(B2B 멀티테넌트, 풀스택 운영)와 우리 Trailog(학습 사이드)를 비교하면서, "운영" 단계와 "학습" 단계에서 같은 NestJS 백엔드가 어떻게 달라지는지 정리.

### 3.1 같은 점

- **NestJS + TypeScript** 코어 스택
- **Redis** 캐시·큐 활용
- **JWT** 인증 (실무는 OAuth2도 같이)
- **Swagger** API 문서 (Trailog도 Phase 2부터 도입 예정)

### 3.2 다른 점 — 표로 정리

| 영역             | 운영 단계 백엔드                               | Trailog (학습 단계)                        | 왜 다른가                                          |
| ---------------- | ---------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| **DB**           | MySQL + TypeORM (조직 표준)                    | PostgreSQL + PostGIS + Prisma 잠정         | 위치 데이터(PostGIS) 필요 + 최신 ORM 학습          |
| **아키텍처**     | 마이크로서비스 (api 서비스 + 스케줄러 분리)    | 모놀리스                                   | 사이드 규모엔 마이크로서비스가 과함                |
| **메시징**       | TCP Microservices + Outbox Pattern             | BullMQ + Redis 잠정                        | 학습 단계엔 단순한 메시지 큐로 충분                |
| **실시간**       | TCP + SSE + WebSocket 모두                     | 미정 (Phase 5)                             | 운영은 다양한 패턴 필요, 학습은 한두 개 충분       |
| **AI**           | Anthropic + Google + OpenAI 멀티 LLM API       | (잠정) CLIP + pgvector 자체 운영           | 운영은 신뢰성·fallback 위주, 학습은 직접 운영 학습 |
| **AWS**          | ECS Fargate + Terraform IaC + CloudWatch + SES | Railway/Fly.io PaaS, IaC 없음              | 학습 단계는 PaaS로 빠르게 굴림. AWS는 별도 학습    |
| **컨테이너**     | Dockerfile + ECR + 자동 배포 파이프라인        | Docker Compose 로컬만 (Phase 4 Dockerfile) | 학습 단계에서 운영 수준까지 한 번에 X              |
| **로깅**         | winston + CloudWatch (전송)                    | 미정 (Phase 4 Sentry + 구조화 로깅)        | 운영은 중앙 집계 필수, 학습 단계는 천천히          |
| **Linter**       | ESLint v8 (eslintrc)                           | ESLint v9 (flat config)                    | 운영은 변경 비용 큼, 사이드는 최신 표준 자유 채택  |
| **패키지매니저** | npm                                            | pnpm                                       | 마찬가지로 운영은 보수적, 사이드는 자유            |
| **모노레포**     | 단일 repo                                      | pnpm workspaces + Turborepo                | 사이드에서 모노레포 도구 학습 의도                 |

### 3.3 결정적인 학습 포인트

**1. "운영 단계 백엔드는 한 번에 만들어지지 않는다"**

- 처음부터 마이크로서비스 + Outbox + 멀티 LLM을 다 깔지 않음
- 모놀리스로 시작 → 트래픽·복잡도 증가 → 필요한 부분만 분리
- Trailog가 모놀리스로 시작하는 이유 (PROJECT_ROOT 8장 안티패턴 3)

**2. "운영은 보수적, 학습은 최신"**

- 운영은 ESLint v8, npm, TypeORM 등 안정 도구 (변경 비용 큼)
- 학습 사이드는 v9, pnpm, Prisma 등 최신 도구 (실험 자유)
- 학습 토픽에서 "두 진영 다 다뤄봤고 차이를 안다"가 강한 시그널

**3. "AWS 풀스택 = Docker 기반"**

- ECS, Fargate, ECR, CloudWatch, ALB 등은 모두 컨테이너 전제
- Docker 모르면 AWS 인프라 70% 이상이 추상적으로 보임
- 학습 영역 1번(인프라/DevOps) 본격 채우려면 Docker가 입구

**4. "분산 패턴은 만나야 보인다"**

- Outbox Pattern, idempotency, circuit breaker, saga 패턴 등은 분산 시스템에서만 필요
- 모놀리스 학습 단계엔 안 만남
- 그래서 **참조 코드 읽기**가 사이드 코딩보다 학습 가치 클 때 있음 (특히 advanced 패턴)

**5. "Dockerfile 작성은 단순 카피가 아님"**

- 베이스 이미지 선택 (alpine vs slim vs full)
- 레이어 캐싱 최적화 (변경 적은 것부터 먼저 COPY)
- multi-stage build로 production 이미지 작게 유지
- 보안 (root 안 쓰기, secrets 안 박기)
- → Phase 4에서 본격 학습

---

## 흔한 함정 / 주의할 점

1. **로컬 docker compose ≠ 운영 ECS** — 비슷한 컨테이너지만 네트워크/보안/스케일링 모델이 다름. compose에서 동작한다고 ECS에서 그대로 도는 거 아님 (예: localhost 접근, 환경변수 주입 방식).
2. **Dockerfile에 secrets 박지 말 것** — 빌드 시점에 박힌 값은 이미지에 영구히 남음. 환경변수, ECS Task Definition의 Secrets Manager 통합 등으로 런타임 주입.
3. **이미지 태그 `latest` 운영에 쓰지 말 것** — 어떤 버전인지 모름. 항상 `v1.2.3` 또는 git SHA 같은 명시적 태그.
4. **ARM Mac에서 만든 이미지가 x86 운영에서 안 돔** — `docker buildx build --platform linux/amd64` 옵션으로 cross-arch 빌드.
5. **컨테이너 자체가 보안 경계가 아님** — root 권한, 호스트 마운트 등 잘못 쓰면 컨테이너 탈출 가능. 운영은 추가 격리(seccomp, capabilities 제한).

## 더 파볼 거리 (선택)

- **Dockerfile 작성 + multi-stage build** — Phase 4에서 본격
- **ECS Task Definition / Service / Cluster 개념** — AWS 학습 시
- **CI/CD: GitHub Actions → ECR push → ECS 롤링** — Phase 4 배포 학습
- **Outbox Pattern** — 분산 트랜잭션 보장의 전형 (advanced)
- **Kubernetes 기초** — ECS와 비교 (시장 표준이라 익혀두면 가치)
- **AWS Secrets Manager + ECS 통합** — 런타임 시크릿 주입
- **컨테이너 보안** — 이미지 스캐닝, runtime 보안, signed images

## 참고 링크

- [Docker 공식 docs](https://docs.docker.com/)
- [AWS ECS 공식](https://docs.aws.amazon.com/ecs/)
- [Twelve-Factor App](https://12factor.net/) — 컨테이너 친화 백엔드 설계 원칙
- [Outbox Pattern 설명 (microservices.io)](https://microservices.io/patterns/data/transactional-outbox.html)
- 관련 노트: [Docker Compose 기초](./docker-compose-essentials.md)
- 관련 코드: `docker/compose.yml`, (Phase 4 예정) `apps/server/Dockerfile`

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
