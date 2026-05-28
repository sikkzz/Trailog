# PostgreSQL vs MySQL — Trailog가 PostgreSQL을 고른 이유

> **작성일**: 2026-05-28
> **작성**: Claude (프롬프팅: @sikkzz)
> **학습 영역**: 인프라/DevOps + DB 설계
> **관련 문서**: [Phase 2 Spec 4.2 DB 스키마](../specs/phase-02-core-features.md), [ADR-0006 ORM 선택](../decisions/0006-orm-typeorm.md), [학습 노트: typeorm-deep-dive](./typeorm-deep-dive.md)
>
> 참조 환경은 MySQL, Trailog는 PostgreSQL. 의도적으로 다른 선택. 사유 + MySQL과의 차이 + 실무 학습 가치까지.

---

## 한 줄 요약

**PostGIS 때문에 PostgreSQL 결정**. 나머지(JSONB, PaaS 친화, JSON 인덱스, JSON 모던 트렌드)는 보조 사유. 참조 MySQL과 의도적 다양성 — ORM(TypeORM)은 친숙도 정복, DB는 새 영역 학습이라는 두 갈래 전략.

## Trailog의 본질과 직결: PostGIS

Trailog = "여행 사진을 지도 위에 보는 앱". 위치 기반 쿼리가 핵심:

```sql
-- 반경 5km 안 사진 (지도 화면)
SELECT * FROM photos
WHERE ST_DWithin(
  location::geography,
  ST_GeomFromText('POINT(126.978 37.566)', 4326)::geography,
  5000  -- meters
);

-- 두 지점 거리
SELECT ST_Distance(p1.location, p2.location) FROM photos p1, photos p2 ...;

-- 지도 viewport (경계 박스) 안 사진
SELECT * FROM photos
WHERE location && ST_MakeEnvelope(126.9, 37.5, 127.0, 37.6, 4326);
```

MySQL도 Spatial 타입 있지만:

| 항목            | MySQL Spatial   | PostGIS                                                          |
| --------------- | --------------- | ---------------------------------------------------------------- |
| 함수 개수       | 수십            | 수백 (ST_Within / Intersects / Buffer / Centroid / ...)          |
| 공간 인덱스     | R-Tree (제한적) | **GiST + SP-GiST + BRIN** (백만 row+ 빠름)                       |
| 좌표계 변환     | 제한적          | **자유** (4326 ↔ 3857 ↔ ...)                                     |
| 클라이언트 호환 | 제한적          | react-native-maps / MapLibre / Leaflet 모두 PostGIS GeoJSON 자연 |
| 사실상 표준     | ❌              | ⭐ **위치 기반 서비스의 사실상 표준**                            |

**이거 하나로도 PostgreSQL 결정 가능**.

## 보조 사유 4가지

### 1. JSONB — EXIF 같은 유연 데이터

사진 EXIF는 카메라 모델별 필드 다양 (수십~수백 개). JSONB 컬럼 한 개로 그대로 저장:

```sql
SELECT exif->>'CameraModel' FROM photos
WHERE exif @> '{"GPSAltitude": 1500}';

-- GIN 인덱스로 검색 빠름
CREATE INDEX idx_photos_exif ON photos USING GIN (exif jsonb_path_ops);
```

MySQL JSON도 있지만 PostgreSQL JSONB:

- **binary 저장 → 읽기/쓰기 빠름**
- **인덱스 지원 (GIN)**
- **연산자 풍부** (`@>`, `->`, `->>`, `#>`, `?`, `?&`, `?|`, ...)

### 2. PaaS 친화 — Phase 2 운영 호스팅 선택지

| PaaS         | Postgres                     | MySQL  |
| ------------ | ---------------------------- | ------ |
| Supabase     | ✅ 무료 500MB + Auth/Storage | ❌     |
| Neon         | ✅ 서버리스 + branching      | ❌     |
| Fly Postgres | ✅ 클러스터                  | ❌     |
| Render       | ✅ 90일 무료                 | 유료만 |
| Railway      | ✅                           | ✅     |
| AWS RDS      | ✅                           | ✅     |

→ Postgres 진영이 모던 PaaS 선택지 풍부. Phase 2 4.2 진입 시 Q11(DB 호스팅) 결정에 영향.

### 3. DDL 트랜잭션 — 마이그레이션 안전성 ⭐

대부분 사람이 모르는 큰 차이:

| 마이그레이션 시나리오          | MySQL                        | PostgreSQL                   |
| ------------------------------ | ---------------------------- | ---------------------------- |
| ALTER TABLE 중 실패            | **partial 적용** (수동 정리) | **전체 rollback** (트랜잭션) |
| 여러 ALTER + CREATE INDEX 묶음 | 한 줄씩 atomic               | 한 트랜잭션으로 atomic       |
| 운영 마이그레이션 위험도       | 높음                         | 낮음                         |

**실무 백엔드 사례 인지**: 실무가 MySQL이라서 DDL 마이그레이션 시 신중해야 함. 사이드 Postgres에서 DDL 트랜잭션 경험 후 참조 코드에서 anti-pattern 발견 가능.

### 4. 모던 NestJS 트렌드

신규 NestJS 프로젝트 대다수 PostgreSQL 채택 (DB-Engines 트렌드, GitHub 새 프로젝트 비율). 참조 MySQL은 LAMP 시대 잔재 + 안정성 우선.

## 참조 MySQL vs 사이드 PostgreSQL — 의도적 다양성

ORM 결정(TypeORM)과 정반대 전략:

| 영역    | 전략                              | 사유                                                      |
| ------- | --------------------------------- | --------------------------------------------------------- |
| **ORM** | 회사와 같음 (TypeORM 친숙도 정복) | API 패턴 비슷 — 한 쪽 깊이가 다른 쪽 전이                 |
| **DB**  | 회사와 다름 (PostgreSQL 새 영역)  | SQL 방언 + 운영 특성이 달라 두 진영 다뤄본 게 강한 시그널 |

학습 토픽 어필:

> "참조 MySQL 운영 + 사이드 PostgreSQL 본격 학습 → 두 진영 차이 직접 비교한 경험"

## MySQL vs PostgreSQL 차이표 (자세히)

| 항목              | MySQL 8.x                       | PostgreSQL 16                                    |
| ----------------- | ------------------------------- | ------------------------------------------------ |
| 출생              | 1995 (Oracle 소유)              | 1986 (BSD 진영)                                  |
| 라이선스          | GPL + Commercial dual           | PostgreSQL License (BSD-like, 더 자유)           |
| 표준 SQL 준수     | 느슨 (자체 방언 많음)           | 엄격 (ANSI SQL 충실)                             |
| JSON              | 5.7+ JSON, 8.0 성숙             | **JSONB (binary + indexable)**                   |
| 공간 데이터       | Spatial 기본 (제한적)           | **PostGIS (사실상 표준)**                        |
| 텍스트 검색       | FULLTEXT 인덱스                 | **tsvector + GIN** (multi-lang 우수)             |
| 동시성 (MVCC)     | InnoDB                          | 더 정교 + transactional DDL                      |
| 인덱스 종류       | B-Tree, FULLTEXT, Spatial, Hash | **B-Tree, GIN, GiST, BRIN, Hash, SP-GiST**       |
| Sequences         | AUTO_INCREMENT (테이블 종속)    | **SEQUENCE (독립 객체, 여러 테이블 공유 가능)**  |
| Transactional DDL | ❌ 부분                         | ✅ **DDL도 트랜잭션 안에서**                     |
| CTE               | 8.0+ 지원                       | ✅ 강력 (재귀 CTE 등)                            |
| Window 함수       | 8.0+ 지원                       | ✅ 풍부                                          |
| Read replica      | 쉬움 (binlog 기반)              | 가능 (streaming, logical replication)            |
| 단순 OLTP 성능    | 약간 빠름                       | 비슷                                             |
| 복잡 분석 쿼리    | 보통                            | **우수 (planner 똑똑)**                          |
| 클라우드 PaaS     | RDS, Aurora MySQL               | **RDS, Aurora Postgres, Supabase, Neon, Render** |
| DB-Engines 트렌드 | 안정 (점진)                     | **빠른 성장** (1위)                              |
| 한국 시간 처리    | `timezone: '+09:00'` 명시 권장  | `timestamptz` 자체로 UTC 저장 + 클라이언트 변환  |
| 대표 사용처       | LAMP, WordPress 다수      | 모던 SaaS, 신규 스타트업, GIS/JSON heavy         |

## Trailog가 사용할 PostgreSQL 기능 (Phase 2~)

| 기능                              | 용도                          | sub-phase |
| --------------------------------- | ----------------------------- | --------- |
| **PostGIS geometry(Point, 4326)** | Photo.location                | 4.2       |
| **GiST 공간 인덱스**              | 지도 쿼리 빠름                | 4.2       |
| **JSONB + GIN 인덱스**            | Photo.exif                    | 4.5       |
| **timestamptz**                   | createdAt, updatedAt, takenAt | 4.1+      |
| **uuid 기본 컬럼**                | id (URL 안전)                 | 4.1+      |
| **CTE / Window 함수**             | 통계 쿼리 (Phase 4+)          | Phase 4+  |
| **Full-text search (tsvector)**   | 사진 제목/태그 검색           | Phase 3   |

## 실무 학습 직결 포인트

**실무 백엔드(MySQL) 코드 깊이 보는 데 도움 되는 사이드 학습**:

1. **DDL 트랜잭션 차이 인지** → 실무 마이그레이션 안전성 anti-pattern 발견
2. **JSON vs JSONB 차이** → 실무가 JSON 컬럼 어떻게 쓰는지 비교
3. **timezone 처리** → 실무가 `+09:00` 박는 이유 명확화
4. **Sequences vs AUTO_INCREMENT** → ID 전략 비교
5. **공간 데이터** → 실무가 위치 다뤘다면 비교

## ADR 박제 여부

이 결정은 **Phase 0 시점에 PROJECT_ROOT 4장에서 자연스럽게 박제됨** (별도 ADR 없음). 단 Phase 2 4.2 진입 시 본인이 명확히 알아두면 좋아서 학습 노트로 박제.

향후 정복 포인트:

- **GiST vs SP-GiST vs BRIN** 인덱스 차이 (Phase 2 4.2 인덱스 설계 시)
- **Full-text search (tsvector + GIN)** (Phase 3 검색 기능 도입 시)
- **PostgreSQL Extensions** (uuid-ossp, pgcrypto, pg_trgm 등 — 필요 시점에)
- **VACUUM / autovacuum** 운영 (Phase 4+ 운영 진입 시)

## 참고 링크

- [PostGIS 공식 docs](https://postgis.net/documentation/)
- [PostgreSQL 16 What's new](https://www.postgresql.org/docs/16/release-16.html)
- [DB-Engines Trends](https://db-engines.com/en/ranking_trend)
- [Supabase Postgres](https://supabase.com/docs/guides/database)
- 관련: [ADR-0006 ORM 선택](../decisions/0006-orm-typeorm.md)

## 추가 학습 기록

> 같은 토픽으로 추가 학습한 내용은 아래에 날짜 헤더로 누적.
