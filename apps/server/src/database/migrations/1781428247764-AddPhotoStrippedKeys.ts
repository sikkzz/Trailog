import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Photo entity에 stripped_keys jsonb 컬럼 추가 — Phase 3 5.2 EXIF strip wave.
 *
 * 컬럼:
 *   - stripped_keys jsonb NULL — { all?: R2 key, gps_only?: R2 key }
 *     · 외부 공유 접근 시점에 정책별 lazy 생성 + R2 PUT + DB update
 *     · null: 아직 strip 호출 없음 (또는 정책 'none'만 사용 — 원본 활용)
 *     · 부분: 한 정책만 호출됨 (예: { gps_only: 'user/.../stripped/xxx_gps_only.jpg' })
 *     · 둘 다: 두 정책 모두 호출됨
 *
 * 인덱스 X — 정책별 키는 jsonb 안 — 직접 쿼리 X (entity 단 검사로 충분).
 *
 * R2 key 형식: user/{userId}/moments/{momentId}/stripped/{photoId}_{variant}.{ext}
 */
export class AddPhotoStrippedKeys1781428247764 implements MigrationInterface {
  name = 'AddPhotoStrippedKeys1781428247764';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "photos" ADD "stripped_keys" jsonb`);
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."stripped_keys" IS 'EXIF strip 파일 R2 keys — {all?: key, gps_only?: key} lazy 생성 (Phase 3 5.2). 외부 공유 접근 시점에 정책별 생성 + 캐싱'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "photos" DROP COLUMN "stripped_keys"`);
  }
}
