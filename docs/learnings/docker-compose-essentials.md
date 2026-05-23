# Docker Compose 기초 (로컬 인프라용)

> **작성일**: 2026-05-23
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라 / DevOps (1순위 — Docker 첫 본격 경험)
> **관련 문서**: [Phase 1 Spec](../specs/phase-01-bootstrap.md)

---

## 한 줄 요약

**Docker Compose** = 여러 컨테이너(우리 경우 Postgres + Redis)를 **하나의 YAML 파일**로 선언하고, `docker compose up` 한 줄로 동시에 띄우는 도구. 로컬 개발 환경을 코드로 관리.

## 우리 프로젝트에서 어디에 쓰이는가

- `docker/compose.yml` — Postgres(PostGIS 포함) + Redis 두 서비스 정의
- 루트 `.env` / `.env.example` — DB 접속 정보 환경변수
- 루트 `package.json` 의 `db:up`, `db:down`, `db:psql`, `db:redis` 스크립트 — 자주 쓰는 명령 추상화
- Phase 2부터 백엔드가 이 컨테이너들에 접속해서 사진 메타데이터·캐시·작업 큐 처리 예정

## 어떻게 동작하는가

### 1. 이미지 vs 컨테이너 (가장 핵심)

| 개념           | 비유              | 설명                                            |
| -------------- | ----------------- | ----------------------------------------------- |
| **이미지**     | 클래스 / 설계도   | 읽기 전용 템플릿 (예: `postgis/postgis:16-3.4`) |
| **컨테이너**   | 인스턴스 / 실행체 | 이미지에서 만든 실행 중인 프로세스              |
| **볼륨**       | 외부 디스크       | 컨테이너 삭제돼도 살아남는 데이터 저장소        |
| **네트워크**   | 가상 LAN          | 컨테이너끼리 통신하는 격리된 네트워크           |
| **레지스트리** | 이미지 저장소     | Docker Hub, GHCR 등                             |

핵심 사고: **컨테이너는 일회용**. 데이터는 반드시 볼륨에 둠. 컨테이너 자체는 언제든 죽이고 다시 만들어도 OK.

### 2. Compose 파일 구조 (우리 compose.yml 분석)

```yaml
services: # 컨테이너 정의들
  postgres:
    image: postgis/postgis:16-3.4 # 어떤 이미지에서 만들지
    container_name: trailog-postgres # docker ps 에서 보이는 이름
    restart: unless-stopped # 죽으면 자동 재시작 (수동 stop 제외)
    ports:
      - '${POSTGRES_PORT:-5432}:5432' # 호스트:컨테이너 포트 매핑
    environment: # 컨테이너 내부 환경변수
      POSTGRES_USER: ${POSTGRES_USER:-trailog}
    volumes:
      - postgres_data:/var/lib/postgresql/data # named volume 마운트
    healthcheck: # 컨테이너 준비됐는지 자체 점검
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER']
      interval: 10s
      retries: 5

volumes: # 사용할 named volume 선언
  postgres_data:
    name: trailog_postgres_data # 호스트 디스크 상의 실제 이름
```

### 3. Named Volume vs Bind Mount

| 종류             | 표현                 | 용도                                | 데이터 위치                    |
| ---------------- | -------------------- | ----------------------------------- | ------------------------------ |
| **Named volume** | `postgres_data:/...` | DB 데이터처럼 영속화                | Docker 관리 영역 (호스트 내부) |
| **Bind mount**   | `./data:/...`        | 로컬 코드/설정 파일 컨테이너에 전달 | 호스트의 명시적 경로           |

우리는 named volume 채택. 이유:

- DB 데이터를 Docker가 알아서 관리 (호스트 경로 신경 안 써도 됨)
- 권한·격리 측면에서 더 깔끔
- `docker volume ls` 로 추적 가능

데이터 완전 초기화하고 싶으면: `docker compose down -v` (volume 같이 삭제)
→ `pnpm db:reset` 스크립트가 이 일을 함.

### 4. 환경변수 — 3가지 전달 경로

```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER:-trailog} # 1) 직접 명시 + 변수 치환 + default
env_file:
  - ../.env # 2) 파일에서 일괄 로드
```

추가로:

- **Compose 자체의 변수 치환**: `${VAR}` 패턴은 Compose가 cwd의 `.env`에서 자동 인식
- 우리는 1번 패턴 사용 (default 값 명시로 .env 없어도 동작)

`${VAR:-default}` 형식:

- `${VAR:-trailog}` = VAR 값 있으면 그거, 없거나 빈 문자열이면 `trailog`
- `${VAR-trailog}` = VAR 값 있으면 그거(빈 문자열도 OK), 미정의면 `trailog`

### 5. Healthcheck — "준비 완료" 신호

`docker compose ps` 출력의 `Up 52 seconds (healthy)` 가 이거 결과.

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U trailog']
  interval: 10s # 검사 주기
  timeout: 5s # 한 번 검사 최대 시간
  retries: 5 # 연속 실패 허용 횟수
  start_period: 10s # 초기 grace period (이 기간 실패는 retries에 안 셈)
```

다른 컨테이너가 `depends_on: { postgres: { condition: service_healthy } }` 로 기다릴 수 있음. Phase 1엔 미적용, Phase 2에서 백엔드가 DB 의존 시 추가 예정.

### 6. 네트워크 (자동 처리)

명시 안 해도 Compose가 **default network**를 자동 생성. 같은 compose 안의 서비스끼리 **서비스 이름으로 통신** 가능:

```
백엔드 컨테이너에서:  redis://redis:6379  (호스트명 = 서비스 이름)
호스트 머신에서:      redis://localhost:6379  (포트 매핑 통해)
```

Phase 2에서 백엔드를 Docker로 옮기면 `DATABASE_URL=postgresql://postgres:5432` 식으로 서비스 이름 사용.

## 자주 쓰는 명령 (우리 npm scripts 매핑)

| 명령           | 의미                                 | 우리 스크립트     |
| -------------- | ------------------------------------ | ----------------- |
| `up -d`        | 백그라운드로 모든 컨테이너 시작      | `pnpm db:up`      |
| `down`         | 컨테이너 + 네트워크 정리 (볼륨 유지) | `pnpm db:down`    |
| `down -v`      | 위 + 볼륨까지 삭제 (데이터 초기화!)  | `pnpm db:reset`   |
| `logs -f`      | 실시간 로그 (Ctrl+C로 빠짐)          | `pnpm db:logs`    |
| `ps`           | 컨테이너 상태                        | -                 |
| `exec SVC CMD` | 띄운 컨테이너 안에서 명령 실행       | `pnpm db:psql` 등 |
| `restart SVC`  | 특정 서비스만 재시작                 | -                 |
| `pull`         | 이미지만 미리 받기                   | -                 |

## 흔한 함정 / 주의할 점

1. **컨테이너 안에서 변수 치환 vs Compose 변수 치환 헷갈림**
   - `${VAR}` (Compose 단)는 compose.yml 파싱 시 치환 → 호스트의 `.env` 값
   - `$${VAR}` 또는 `$$VAR` (escape) → 컨테이너 안에서 평가 (예: healthcheck의 shell 명령)
2. **`down` vs `down -v`** — `-v` 빼면 볼륨은 살아남음. 학습 중 헷갈려서 데이터 날리는 경우 흔함.
3. **포트 충돌** — 호스트 5432가 이미 점유 중이면(예: 로컬에 Postgres 별도 설치) 에러. `.env`에서 `POSTGRES_PORT=15432` 같은 식으로 변경.
4. **이미지 업데이트 안 됨** — `docker compose up` 만으론 새 이미지 안 받음. `docker compose pull` 또는 `up --pull always`.
5. **컨테이너 내부 시간대** — 기본 UTC. 한국 시각 필요하면 `TZ=Asia/Seoul` 환경변수.
6. **PostGIS ARM 이슈** (우리 케이스) — `postgis/postgis:17-3.5` 가 ARM64 빌드 없어서 16-3.4로 다운그레이드. 또는 amd64 이미지를 Rosetta로 에뮬레이션 (느림). multi-arch fork(`imresamu/postgis-multiarch`)도 옵션.

## 우리 ARM Mac에서 amd64 이미지를 돌리고 있다는 경고

```
The requested image's platform (linux/amd64) does not match
the detected host platform (linux/arm64/v8)
```

- **무슨 일**: ARM Mac에서 amd64 전용 이미지를 띄울 때 Docker Desktop이 **Rosetta 2**로 자동 에뮬레이션
- **영향**: CPU 성능 30~50% 손해. DB 워크로드는 디스크/네트워크 바운드라 체감 작음
- **언제 신경 쓸까**: 운영 환경, 벤치마크, 대용량 처리. **로컬 개발은 무시 OK**
- **해결법**:
  1. native ARM 이미지 찾기 (`postgis/postgis:16-3.4`도 사실 amd64만 → 우리도 에뮬레이션 중)
  2. multi-arch fork 사용 (`imresamu/postgis-multiarch`)
  3. `platform: linux/amd64` 명시 (현재 묵시적 동작과 같음)

## Compose v1 vs v2 (`docker-compose` vs `docker compose`)

| 버전 | 명령             | 설치 방식                     | 상태       |
| ---- | ---------------- | ----------------------------- | ---------- |
| v1   | `docker-compose` | 별도 Python 패키지            | deprecated |
| v2   | `docker compose` | Docker CLI 플러그인 (Go 작성) | 현 표준    |

우리는 v2 사용 (`docker compose -f ...`). v1 명령은 안 쓰는 게 좋음.

## 더 파볼 거리 (선택)

- **`depends_on` + healthcheck 조합** — 의존 서비스 준비 후 시작 (Phase 2)
- **Multi-stage Dockerfile** — 백엔드 production 이미지 빌드 (Phase 4)
- **Docker layer caching** — 빌드 시간 단축 원리
- **`docker compose --profile`** — 환경별 서비스 그룹 (dev/test 분리)
- **`docker stats`, `docker top`** — 컨테이너 리소스 모니터링
- **Compose의 `secrets`** — 환경변수보다 안전한 비밀값 전달 (production)
- **Bind mount + tmpfs** — 우리는 안 쓰지만 흔한 패턴
- **컨테이너 → 호스트로 파일 복사** — `docker cp` (디버깅 시)

## 참고 링크

- [Docker Compose 공식](https://docs.docker.com/compose/)
- [Compose file 스펙](https://docs.docker.com/compose/compose-file/)
- [PostGIS Docker Hub](https://hub.docker.com/r/postgis/postgis)
- [Redis Docker Hub](https://hub.docker.com/_/redis)
- 관련 코드: `docker/compose.yml`, 루트 `.env.example`

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.

(아직 없음)
