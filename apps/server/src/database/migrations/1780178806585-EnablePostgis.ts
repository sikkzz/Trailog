import type { MigrationInterface, QueryRunner } from 'typeorm';

// PostGIS 확장 enable — PostgreSQL에 공간(geospatial) 자료형 + 함수 + GIST 인덱스 추가.
//
// 학습 포인트:
// - `CREATE EXTENSION` 은 superuser 권한 필요 — Fly Postgres는 기본 superuser, Supabase는
//   대시보드에서 PostGIS 토글 또는 SQL 권한 부여 필요.
// - `IF NOT EXISTS` — 이미 enabled된 DB(재실행)에서도 안전.
// - PostGIS 자체는 schema `public`에 함수/타입 박힘 (search_path 영향 X).
//
// 이 마이그레이션 적용 후 사용 가능:
// - `geometry(Point, 4326)`, `geography(Point, 4326)` 자료형
// - `ST_*` 함수 — ST_MakePoint, ST_Within, ST_DWithin, ST_Distance 등
// - GIST 인덱스 — 공간 쿼리 O(log n) (B-tree로 처리 불가)
//
// 향후 4.5 EXIF에서 photos.location 컬럼 + GIST 인덱스 추가 시 활용.

export class EnablePostgis1780178806585 implements MigrationInterface {
  name = 'EnablePostgis1780178806585';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // RESTRICT (default) — PostGIS 자료형 쓰는 컬럼/테이블 있으면 에러로 차단 (안전).
    // CASCADE 원하면 명시. 학습 단계는 RESTRICT가 안전 default.
    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis`);
  }
}
