import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhotoExifColumns1780409731442 implements MigrationInterface {
  name = 'AddPhotoExifColumns1780409731442';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "photos" ADD "taken_at" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."taken_at" IS 'EXIF DateTimeOriginal — 실제 촬영 시각. NULL 가능 (EXIF 없는 사진/스크린샷) (Phase 2 4.5)'`,
    );
    await queryRunner.query(`ALTER TABLE "photos" ADD "location" geometry(Point,4326)`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."location" IS 'EXIF GPS lat/lng → PostGIS Point (WGS84). NULL 가능 (GPS 없는 사진) (Phase 2 4.5)'`,
    );
    await queryRunner.query(`ALTER TABLE "photos" ADD "exif_json" jsonb`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."exif_json" IS '원본 EXIF metadata 보존 — 미래 새 필드 추출 시 reprocess 없이 활용 (Phase 2 4.5)'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_83cb4e6bde0428d941bdd7e30a" ON "photos"  ("taken_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c670f4046706852b074f24cea3" ON "photos" USING gist ("location") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_c670f4046706852b074f24cea3"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_83cb4e6bde0428d941bdd7e30a"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."exif_json" IS '원본 EXIF metadata 보존 — 미래 새 필드 추출 시 reprocess 없이 활용 (Phase 2 4.5)'`,
    );
    await queryRunner.query(`ALTER TABLE "photos" DROP COLUMN "exif_json"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."location" IS 'EXIF GPS lat/lng → PostGIS Point (WGS84). NULL 가능 (GPS 없는 사진) (Phase 2 4.5)'`,
    );
    await queryRunner.query(`ALTER TABLE "photos" DROP COLUMN "location"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."taken_at" IS 'EXIF DateTimeOriginal — 실제 촬영 시각. NULL 가능 (EXIF 없는 사진/스크린샷) (Phase 2 4.5)'`,
    );
    await queryRunner.query(`ALTER TABLE "photos" DROP COLUMN "taken_at"`);
  }
}
