import { MigrationInterface, QueryRunner } from 'typeorm';

export class AugmentPhotosForProcessing1780223924235 implements MigrationInterface {
  name = 'AugmentPhotosForProcessing1780223924235';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "photos" ADD "thumbnail_keys" jsonb`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."thumbnail_keys" IS 'sharp 완료 시 {s,m,l: R2 key} 박힘. 처리 전엔 NULL (Phase 2 4.4)'`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" ADD "processing_status" character varying(20) NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."processing_status" IS 'pending/done/failed — confirm 직후 pending, worker 종료 시 갱신 (Phase 2 4.4)'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."processing_status" IS 'pending/done/failed — confirm 직후 pending, worker 종료 시 갱신 (Phase 2 4.4)'`,
    );
    await queryRunner.query(`ALTER TABLE "photos" DROP COLUMN "processing_status"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."thumbnail_keys" IS 'sharp 완료 시 {s,m,l: R2 key} 박힘. 처리 전엔 NULL (Phase 2 4.4)'`,
    );
    await queryRunner.query(`ALTER TABLE "photos" DROP COLUMN "thumbnail_keys"`);
  }
}
