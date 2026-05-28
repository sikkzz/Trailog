# TypeORM 깊이 정복 (Phase 2 진행 누적)

> **작성일**: 2026-05-28
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라/DevOps + DB
> **관련 문서**: [ADR-0006 ORM 선택](../decisions/0006-orm-typeorm.md), [Phase 2 Spec 4.1~4.2](../specs/phase-02-core-features.md)
>
> 본인이 NestJS + TypeORM 환경에서 "어느정도 익숙하지만 제대로 학습한 건 아님"이라고 명시. 사이드에서 본격 정복하는 항목들과 추후 인지할 포인트 누적.

---

## 한 줄 요약

TypeORM은 친숙한 도구 — Trailog 사이드의 목표는 **실무에서 그냥 따라 쓴 패턴을 본격적으로 짚어 깊이 만들기**. ADR-0006의 학습 포인트 9개를 Phase 2 진행하며 차근차근 정복.

## 본 노트의 운영 방식

- 한 토픽씩 정복할 때마다 섹션 추가 (날짜 헤더로 누적)
- 참조 코드와의 비교는 일반화된 표현 사용 ("실무 백엔드 사례")
- 추후 정복할 항목은 메모리에 박제 — entity 5개+ / 운영 진입 / 참조 코드 비교 질문 시 자동 인지

---

## 2026-05-28 — Trailog 첫 TypeORM 셋업 (Phase 2 4.1 진입)

### 도입 패턴 (단순화)

```
apps/server/src/
├── database/
│   ├── data-source.ts        # DataSource + dataSourceOptions
│   ├── database.module.ts    # NestJS Module wrapper (TypeOrmModule.forRoot)
│   └── migrations/           # 마이그레이션 파일
└── users/
    └── user.entity.ts        # 첫 entity
```

핵심 결정:

1. **DataSource 단일 소스** — `dataSourceOptions`를 CLI와 NestJS 모듈에서 공유. drift 방지.
2. **DATABASE_URL 단일** — 12-factor 표준 (Fly.io secrets, 운영 PaaS 친화)
3. **synchronize: false** — entity 변경이 즉시 DB 반영되는 거 차단. 학습 목적으로 마이그레이션 흐름 명시.
4. **glob 마이그레이션** — `migrations/*.{ts,js}` 자동 매칭. 사이드 규모 (현재 1개) 작아서 OK.
5. **migration:generate 후 prettier 자동** — scripts 끝에 `&& prettier --write` 추가. raw 포맷 commit 방지.

### 학습 포인트 진행 트래커

ADR-0006의 9개 항목 중 현재 상태:

| #   | 영역                                           | 현재 상태              | 정복 시점                         |
| --- | ---------------------------------------------- | ---------------------- | --------------------------------- |
| 1   | Entity 관계 (eager/lazy/cascade)               | 미진행                 | 4.2 Trip/Photo 관계 등장 시       |
| 2   | Repository pattern                             | 미진행                 | 4.1 인증 service 작성 시          |
| 3   | 마이그레이션 (generate vs create, drift, 운영) | **진행 중** ⭐         | 첫 마이그레이션부터               |
| 4   | 트랜잭션 (QueryRunner, typeorm-transactional)  | 미진행                 | 4.3 사진 업로드 atomicity 필요 시 |
| 5   | 인덱스 / 제약 (composite, GIN/GIST)            | 미진행                 | 4.2 Photo.location GIST 시        |
| 6   | Query Builder vs Repository API                | 미진행                 | 4.7 지도 공간 쿼리 시             |
| 7   | N+1 회피 (relations vs leftJoinAndSelect)      | 미진행                 | 4.6 모바일 리스트 화면 시         |
| 8   | 0.2 → 0.3 → 1.0 변화                           | 일부 인지 (1.0 메이저) | 별도 시점                         |
| 9   | PostGIS 통합                                   | 미진행                 | 4.2 Photo.location                |

---

## 참조 (실무 백엔드 사례) vs Trailog 패턴 비교

참조 코드의 패턴 중 사이드와 의도적으로 다르게 한 부분 + 추후 채택 검토할 부분을 박제. **참조 코드 디테일은 외부 노출 X**, 패턴 자체만 일반화 기록.

### 1. DataSource 파일 위치/이름

| 항목 | 실무 백엔드 사례                                         | Trailog                                   |
| ---- | -------------------------------------------------------- | ----------------------------------------- |
| 위치 | src 루트, 파일명으로 역할 표현 (`*-migration.config.ts`) | `src/database/data-source.ts` (폴더 격리) |
| 사유 | 80+ 도메인의 큰 코드, 평면이 자연                        | 사이드 규모 → 격리가 인지 부하 ↓          |

### 2. DB 연결 정보

| 항목 | 실무 백엔드 사례                               | Trailog               |
| ---- | ---------------------------------------------- | --------------------- |
| 방식 | 환경변수 분리 (host/port/user/pass/db)         | `DATABASE_URL` 단일   |
| 사유 | 환경별 세부 제어 (timezone, pool 등 함께 관리) | 12-factor + PaaS 친화 |

### 3. 마이그레이션 목록 — 명시적 배열 vs glob ⭐ (큰 차이)

실무 백엔드 사례:

```typescript
// 명시적 배열 (수십~수백 개 path.join 줄줄이)
migrations: [
  path.join(migrationsDir, '1772700000000-create-x{.ts,.js}'),
  path.join(migrationsDir, '1772700100000-y{.ts,.js}'),
  // path.join(migrationsDir, '1775555557049-z{.ts,.js}'), // ← 일부러 skip 가능
  // ... 백 개 이상
],
```

Trailog:

```typescript
migrations: [__dirname + '/migrations/*.{ts,js}'],
```

명시적 배열의 장점:

- **순서 통제** — timestamp 자동 정렬 외 강제 가능
- **특정 마이그레이션 일시 skip** (주석 처리)
- **drift 감지** — 새 파일 자동 포함 X, 명시 add 필요 → 누락/실수 방어
- **운영 안전성** — 큰 규모에서 자동 매칭은 위험

**🔔 추후 정복 트리거**: 마이그레이션이 ~10개 넘으면 명시적 배열로 전환 검토. Phase 2 후반 또는 Phase 3에 자동으로 인지됨.

### 4. NestJS 통합 — forRoot vs forRootAsync

| 항목 | 실무 백엔드 사례                                                     | Trailog                                         |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------- |
| 방식 | `TypeOrmModule.forRootAsync` + `useFactory` + `ConfigService` inject | `TypeOrmModule.forRoot(dataSourceOptions)` 정적 |
| 사유 | env 검증 + 동적 옵션 (LOCAL/DEV/PROD 분기, multi-DB 등)              | 단일 DB + dataSourceOptions 재사용으로 충분     |

forRootAsync의 power-user 패턴:

- env zod/class-validator 검증
- 환경별 옵션 동적 분기
- multi-DB (main + log/analytics 분리)
- `inject: [ConfigService]`로 DI 활용

**🔔 추후 정복 트리거**: Phase 4 운영 진입 시 환경별 옵션 분기 필요 + multi-DB 검토 시점에 자동 인지.

### 5. Entities 선언 패턴

실무 백엔드 사례 (도메인 5개+):

```typescript
// src/users/entities/index.ts
export const userEntities = [User, UserProfile, UserSetting];

// src/photos/entities/index.ts
export const photoEntities = [Photo, PhotoExif, PhotoThumbnail];

// data-source.ts
entities: [...userEntities, ...photoEntities, ...tripEntities],
```

Trailog 현재 (entity 1개):

```typescript
entities: [User];
```

**🔔 추후 정복 트리거**: entity 5개+ 넘기면 spread 패턴 도입. Phase 2 4.2 (Trip/Photo) 진행 시 자동 인지.

### 6. migration:generate 후 prettier 자동 ⭐ (2026-05-28 채택)

실무 백엔드 사례:

```jsonc
"migration:create": "... migration:generate ./src/migrations/prev && prettier --write src/migrations/*-prev.ts",
//                                                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                                                                  생성 직후 즉시 포맷
```

Trailog 채택 (옵션 A, 2026-05-28):

```jsonc
"migration:generate": "pnpm typeorm migration:generate -d src/database/data-source.ts && prettier --write src/database/migrations/*.ts"
```

→ 생성된 마이그레이션 raw 상태로 commit 들어가는 거 방지. lint-staged가 commit 시점에 처리하긴 하지만, 그 사이에 본인이 코드 보면 raw 포맷이라 거슬림. **참조 패턴 즉시 채택**.

### 7. 운영 디테일 (connection pool, timezone, multi-DB)

실무 백엔드 사례:

```typescript
{
  type: 'mysql',
  timezone: '+09:00',
  extra: {
    connectionLimit: 10,
    waitForConnections: true,
    maxIdle: 10,
    queueLimit: 200,
    connectTimeout: 10000,
    enableKeepAlive: false,
    idleTimeout: 60000,
  },
  // 로그 DB 별도 연결
}
```

Trailog 현재: 모두 기본값.

**🔔 추후 정복 트리거**: Phase 4 운영 진입 시 (Fly.io spike 부하 + 마이그레이션 안정성). connection pool 부족으로 502 발생 시점에 자동 인지.

### 8. 마이그레이션 자동 실행 — ECS one-off task

실무 백엔드 사례: 2026-02-26에 ECS 마이그레이션 자동 실행 도입 (배포 파이프라인의 분리된 task).

Trailog 현재: `RUN_MIGRATIONS_ON_BOOT=false` (수동 실행). GitHub Actions deploy workflow에 `pnpm migration:run` 단계 추가 예정.

**🔔 추후 정복 트리거**: Phase 2 4.2 (DB 스키마) 진입 시 자동 인지. deploy.yml 갱신.

---

## 정복 미진행 항목 추적표

다음 항목들은 Phase 2 후반 또는 Phase 4 진입 시 자동 인지 필요:

| 항목                          | 트리거 시점               | 메모리 박제               |
| ----------------------------- | ------------------------- | ------------------------- |
| Entity spread 패턴            | entity 5개+ (Phase 2 4.2) | typeorm-deep-dive-revisit |
| 마이그레이션 명시 배열        | migration 10개+           | typeorm-deep-dive-revisit |
| forRootAsync + env 검증       | Phase 4 운영 진입         | typeorm-deep-dive-revisit |
| connection pool / timezone    | Phase 4 부하 발생         | typeorm-deep-dive-revisit |
| Multi-DB (log/analytics 분리) | Phase 5+ 운영 안정화      | typeorm-deep-dive-revisit |
| 마이그레이션 자동 ECS task    | Phase 2 4.2               | typeorm-deep-dive-revisit |

→ Claude 메모리에 박제됨. 위 시점이 오면 자동 인지 + 본인에게 알림.

---

## 흔한 함정

(정복하면서 누적)

## 참고 링크

- [TypeORM 0.3 마이그레이션 가이드](https://typeorm.io/migrations)
- [NestJS Database 가이드](https://docs.nestjs.com/techniques/database)
- 관련 ADR: [ADR-0006](../decisions/0006-orm-typeorm.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
