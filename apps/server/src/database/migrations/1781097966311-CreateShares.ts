import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Share entity 신규 생성 — Phase 3 5.1 공유 링크 wave.
 *
 * 컬럼:
 *   - id uuid PK
 *   - token varchar(21) UNIQUE — nanoid (URL-safe, ADR-0014)
 *   - owner_id uuid FK → users.id (ON DELETE CASCADE)
 *   - target enum('photo','moment') — polymorphic 대상 종류
 *   - target_id uuid — photo.id 또는 moment.id (FK 제약 X, service 단 검증)
 *   - expires_at timestamptz nullable — 만료 시각 (null = 영구)
 *   - password_hash varchar(60) nullable — bcrypt (옵션)
 *   - exif_strip_policy enum('all','gps_only','none') default 'gps_only' — 5.2 본격 활용
 *   - created_at timestamptz
 *
 * 인덱스:
 *   - token UNIQUE — 외부 접근 hot path 조회
 *   - owner_id — 본인 활성 공유 목록 조회
 *   - expires_at — Phase 4 cleanup cron job 활용
 */
export class CreateShares1781097966311 implements MigrationInterface {
  name = 'CreateShares1781097966311';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // enum type 신규 — TypeORM은 enum 컬럼 추가 시 별도 type 생성 필요
    await queryRunner.query(`CREATE TYPE "public"."shares_target_enum" AS ENUM('photo', 'moment')`);
    await queryRunner.query(
      `CREATE TYPE "public"."shares_exif_strip_policy_enum" AS ENUM('all', 'gps_only', 'none')`,
    );

    await queryRunner.query(
      `CREATE TABLE "shares" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "token" character varying(21) NOT NULL,
        "owner_id" uuid NOT NULL,
        "target" "public"."shares_target_enum" NOT NULL,
        "target_id" uuid NOT NULL,
        "expires_at" TIMESTAMP WITH TIME ZONE,
        "password_hash" character varying(60),
        "exif_strip_policy" "public"."shares_exif_strip_policy_enum" NOT NULL DEFAULT 'gps_only',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shares_id" PRIMARY KEY ("id")
      )`,
    );

    // psql COMMENT — Entity comment 룰 (인수인계 패턴 메모리)
    await queryRunner.query(`COMMENT ON TABLE "shares" IS '공유 링크 토큰 — 외부 read-only 접근'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "shares"."token" IS 'nanoid 21자 토큰 — URL path (/s/{token})에 노출, UNIQUE'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "shares"."owner_id" IS '공유 생성자 User.id (FK, ON DELETE CASCADE) — 본인 활성 공유 목록 조회용'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "shares"."target" IS '공유 대상 종류 — photo(단일 사진) 또는 moment(Moment 전체)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "shares"."target_id" IS 'target=photo면 photo.id, target=moment면 moment.id (polymorphic, FK 제약 X)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "shares"."expires_at" IS '만료 시각 — null = 영구. 인덱스로 cleanup cron job 활용 (Phase 4)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "shares"."password_hash" IS 'bcrypt hash (60자 고정) — 비밀번호 보호 옵션. null = 비밀번호 X'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "shares"."exif_strip_policy" IS 'EXIF strip 정책 — 5.2 wave에서 본격 활용. 5.1은 컬럼만 저장'`,
    );

    // 인덱스
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_shares_token" ON "shares" ("token")`);
    await queryRunner.query(`CREATE INDEX "IDX_shares_owner_id" ON "shares" ("owner_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_shares_expires_at" ON "shares" ("expires_at")`);

    // FK 제약
    await queryRunner.query(
      `ALTER TABLE "shares" ADD CONSTRAINT "FK_shares_owner_id" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shares" DROP CONSTRAINT "FK_shares_owner_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_shares_expires_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_shares_owner_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_shares_token"`);
    await queryRunner.query(`DROP TABLE "shares"`);
    await queryRunner.query(`DROP TYPE "public"."shares_exif_strip_policy_enum"`);
    await queryRunner.query(`DROP TYPE "public"."shares_target_enum"`);
  }
}
