# ADR-0006: ORM — TypeORM 채택 (Prisma 대신)

> **상태**: ✅ Accepted (확정 2026-05-28)
> **날짜**: 2026-05-28
> **결정자**: @sikkzz (제안: Claude)
> **관련 문서**: [Phase 2 Spec 4.1~4.2](../specs/phase-02-core-features.md), [PROJECT_ROOT 4장 서버 스택](../PROJECT_ROOT.md)

---

## 맥락 (Context)

Phase 2 4.1 (인증) + 4.2 (DB 스키마) 진입 직전 결정 필요. 사용자/여행/사진 엔티티 + PostGIS geometry(Point) 사용 예정. ORM 후보는 모던 트렌드 Prisma와 NestJS 정석 TypeORM.

본인 컨텍스트:

- **참조 백엔드 = NestJS + TypeORM** 사용 중
- **실무에서 TypeORM 어느정도 익숙하지만 "제대로 학습한 건 아님"** — 친숙도 있지만 깊이 X
- 사이드 본질: PROJECT_ROOT 2장 "의도적으로 못 다뤄본 영역 채우기"
- Phase 2 본진은 ORM 자체가 아니라 #2 (이미지/미디어) + #3 (지도)

## 결정 (Decision)

**선택**: ✅ **TypeORM** (0.3.x)

세부:

- `@nestjs/typeorm` + `typeorm` 도입
- DataMapper 패턴 (NestJS 정석, Repository injection)
- 마이그레이션: TypeORM CLI (`typeorm migration:generate / run / revert`)
- PostGIS: `@Column({ type: 'geometry', ... })` + 필요시 raw SQL
- 위치 쿼리: PostGIS 함수 raw SQL (`ST_DWithin`, `ST_GeomFromText` 등)

## 이유 / 트레이드오프

### 왜 TypeORM인가

#### 1. **친숙도를 "제대로 학습"으로 끌어올리기** ⭐

본인이 "실무에서 어느정도 익숙하지만 제대로 학습한 건 아님"이라고 명시. 사이드에서 본격 정복하면:

- 실무에서 그냥 따라 쓴 부분(Repository pattern, 마이그레이션 흐름, 트랜잭션, eager/lazy 등)을 사이드에서 직접 짚어 깊이 만들기
- 참조 코드 이해도 즉시 ↑
- 사이드 학습이 사내 기여로 직접 연결 (anti-pattern 찾아 개선 제안 등)

#### 2. **사이드 본진 시간 보호**

Phase 2의 진짜 학습 영역은 **#2 이미지/미디어** + **#3 지도/시각화**. ORM은 도구.

- Prisma 새로 배우면 ORM 자체에 시간 소진 → 본진 시간 감소
- TypeORM 친숙도 활용 → 본진(R2 presigned URL, sharp, BullMQ, react-native-maps)에 더 많은 시간

#### 3. **NestJS 공식 추천 + 통합 자연스러움**

- `@nestjs/typeorm`은 NestJS 공식 모듈. Dependency Injection 자연스럽게 동작
- Repository pattern이 NestJS service 계층과 일치
- Prisma도 가능하지만 외부 라이브러리 (`@prisma/client`를 NestJS Module로 감싸는 boilerplate)

#### 4. **학습 토픽 어필 스토리 강함**

포트폴리오/학습 토픽 어필:

> "실무에서 사용하던 TypeORM을 사이드에서 본격 정복. 참조 코드의 anti-pattern (eager loading N+1, 마이그레이션 누락 등)을 발견해 개선 제안."

이는 **"1인 풀팀 + 문서 자동화 + ORM 깊이 정복"** 스토리 풀로 연결. Prisma 새로 배운 경험보다 풀어낼 거리 많음.

#### 5. **PostGIS 호환은 두 ORM 모두 한계 동일**

- Prisma: `Unsupported(geometry)` 또는 preview feature `postgresqlExtensions`
- TypeORM: `@Column({ type: 'geometry' })` + raw SQL

→ PostGIS 본격 사용은 어차피 raw SQL이라 ORM 선택이 별로 영향 X.

### 얻는 것

- **TypeORM 깊이 정복** (Repository, Active Record vs Data Mapper, 마이그레이션, 트랜잭션, 인덱스, Query Builder)
- **참조 코드 이해도** ↑ + 사내 기여 가능 토픽
- **본진(이미지/미디어/지도) 시간 보호**
- **NestJS 정석 패턴 학습**

### 포기하는 것

- **Prisma 모던 트렌드 경험** — Phase 후속 작업 또는 별도 프로젝트로 미룸
- **타입 자동 생성** — TypeORM은 entity가 타입 자체 (충분히 type-safe)
- **schema-first DSL** — TypeORM의 entity decorator 패턴 (장황한 면 있음)

### 학습 가치 관점

- **본인 갈증 직접 해소** ("TypeORM 제대로 학습")
- 깊이 정복 = 트렌드 follower보다 가치 큼 (실무 환경 컨텍스트에선 특히)
- 트렌드 학습은 Phase 후속 또는 별도 프로젝트로 미루기 (PROJECT_ROOT 결정 3의 Spring 포팅 패턴과 동일 — 비교 학습)

## 검토한 대안

| 대안                    | 장점                                          | 단점                                               | 제외 이유               |
| ----------------------- | --------------------------------------------- | -------------------------------------------------- | ----------------------- |
| **A. TypeORM** ⭐       | 친숙도 정복, NestJS 정석, 본진 시간 보호 | 트렌드 ↓ (0.3 활동 느림), 마이그레이션 boilerplate | (선택안)                |
| B. Prisma               | 모던 트렌드, 타입 자동, schema-first          | 본인 친숙도 X → 본진 시간 뺏김, 참조 환경과 단절        | 본진 시간 보호 우선     |
| C. Drizzle ORM          | 가볍고 SQL-first, 모던                        | 신생, 학습 자료 적음, 참조 미사용                  | 위험 부담               |
| D. Knex (Query Builder) | 가장 SQL에 가까움, 유연                       | ORM이 아니라 mapping/relations 직접 관리           | 사이드 규모엔 과한 손맛 |
| E. Raw SQL + pg         | 가장 단순, ORM 의존 0                         | 매핑/타입 안전성 직접 구현                         | 학습 가치는 작음        |

## 깊이 정복할 학습 포인트

실무에서 그냥 따라 썼을 가능성 있는 부분을 사이드에서 본격 정복:

| 영역               | 실무에서 그냥 썼을 거               | 사이드에서 본격 정복                                                        |
| ------------------ | ----------------------------------- | --------------------------------------------------------------------------- |
| Entity 관계        | `@ManyToOne` 적당히 사용            | eager/lazy/cascade 선택 기준 명확화. N+1 직접 발견 + 회피                   |
| Repository pattern | `@InjectRepository(User)` 그냥 사용 | Data Mapper vs Active Record 차이 + 언제 무엇                               |
| 마이그레이션       | `migration:generate` 실행만         | `generate` vs `create` 차이, drift 대응, 운영 안전 마이그레이션             |
| 트랜잭션           | 가끔 봄                             | `@Transaction` deprecated → `QueryRunner` 직접 또는 `typeorm-transactional` |
| 인덱스 / 제약      | 기본 unique 정도                    | composite, GIN/GIST(PostGIS), partial index                                 |
| Query Builder      | 어렴풋                              | Repository API vs QueryBuilder 선택 기준                                    |
| N+1 회피           | 발견 어려움                         | `relations` vs `leftJoinAndSelect` 차이 직접 측정                           |
| 0.2 → 0.3 변화     | 거의 모름                           | DataSource 도입, deprecated API 정리                                        |
| PostGIS 통합       | 처음                                | `@Column({ type: 'geometry' })` + raw SQL + ST\_\* 함수                     |

위 9개 중 5~6개만 본격 정복해도 실무에서 다른 후배보다 깊은 이해 확보.

## 결과 / 영향

### 신규 파일 (Phase 2 4.1~4.2 진행 시)

- `apps/server/src/database/data-source.ts` — TypeORM DataSource 설정
- `apps/server/src/database/database.module.ts` — NestJS Module wrapper
- `apps/server/src/users/user.entity.ts` — User 엔티티
- `apps/server/src/database/migrations/*` — 마이그레이션 파일
- `apps/server/src/database/migration.config.ts` — CLI 설정

### 변경 파일

- `apps/server/package.json` — `@nestjs/typeorm`, `typeorm`, `pg` (Postgres driver) 의존성
- `apps/server/src/app.module.ts` — DatabaseModule import
- `.env` / `.env.example` — `DATABASE_URL` 활성화
- `docs/PROJECT_ROOT.md` — 4장 서버 표 ORM 항목 "Prisma 또는 TypeORM" → "TypeORM" 확정 + 11장 변경 이력
- `docs/specs/phase-02-core-features.md` — Q1 ✅ Accepted

### 운영 영향

- 로컬 DB는 docker-compose Postgres 그대로 사용 (Phase 1에서 셋업됨)
- 운영 DB는 Phase 2 진입 시 Q11 결정 (Supabase vs Neon 등)
- 마이그레이션은 GitHub Actions deploy workflow에 자동 실행 단계 추가 예정

## 재검토 트리거

다음 중 하나라도 발생하면 이 결정을 재검토:

- **TypeORM 0.3 이후 활동 정체 심화** (예: 보안 패치 안 됨) → Prisma 마이그레이션
- **PostGIS raw SQL 부담이 본진 시간 잠식** → Drizzle/Prisma 비교 재시도
- **실무 환경가 Prisma로 전환** → 사이드도 같이 옮기는 게 실무 학습 직결

## 후속 작업

- [x] Q1 결정 (TypeORM)
- [ ] ADR-0006 작성 (본 문서)
- [ ] Phase 2 spec Q1 박제
- [ ] PROJECT_ROOT 4장 + 11장 갱신
- [ ] `@nestjs/typeorm`, `typeorm`, `pg` 의존성 추가
- [ ] DataSource + DatabaseModule 셋업
- [ ] User 엔티티 + 첫 마이그레이션
- [ ] 학습 노트 `typeorm-deep-dive.md` (선택, 본격 정복 시점에)

## 참고

- [TypeORM 공식 docs](https://typeorm.io/)
- [@nestjs/typeorm 가이드](https://docs.nestjs.com/techniques/database)
- [TypeORM 0.3 변경사항](https://github.com/typeorm/typeorm/releases/tag/0.3.0)
- 관련 ADR: 없음 (DB 호스팅은 별도 ADR — Phase 2 4.2 진입 시)
