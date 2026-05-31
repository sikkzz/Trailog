import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEntityComments1780223473573 implements MigrationInterface {
  name = 'AddEntityComments1780223473573';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`COMMENT ON TABLE "users" IS '사용자 — 인증 + Moment/Photo 소유자'`);
    await queryRunner.query(
      `COMMENT ON TABLE "moments" IS '순간 — 사진/장소/시간으로 박제된 한 단위 (여행/카페/산책 등 모두)'`,
    );
    await queryRunner.query(
      `COMMENT ON TABLE "photos" IS 'Moment에 속한 사진 1장 — 원본 R2 key + 썸네일 + 처리 상태'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."email" IS '로그인 식별자 이메일 (unique). 형식 검증은 DTO 레이어'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "users"."password" IS 'bcrypt hash 저장 (raw 비밀번호 금지). select:false로 기본 조회 제외'`,
    );
    await queryRunner.query(
      `ALTER TABLE "moments" DROP CONSTRAINT "FK_844d564a24fa9f2506810efec9f"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "moments"."user_id" IS '소유자 User.id (FK, ON DELETE CASCADE)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "moments"."title" IS '순간 제목 — 자유 표현 ("도쿄 여행", "성수 ABC 카페" 등)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "moments"."started_at" IS '시작 시각 (사용자 입력, 선택). EXIF takenAt과 별개 — 사용자 의도 표현'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "moments"."ended_at" IS '종료 시각 (사용자 입력, 선택). 장기 여행은 둘 다 채움, 단발은 둘 다 null OK'`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" DROP CONSTRAINT "FK_008670f4d9fbbaa966f3bbb9e7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" DROP CONSTRAINT "FK_c4404a2ee605249b508c623e68f"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."moment_id" IS '소속 Moment.id (FK, ON DELETE CASCADE)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."user_id" IS '소유자 User.id denorm — 권한 체크 빠르게 (FK, ON DELETE CASCADE)'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "photos"."original_key" IS 'R2 객체 key — 형식: user/{userId}/moments/{momentId}/{photoId}.{ext}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "moments" ADD CONSTRAINT "FK_844d564a24fa9f2506810efec9f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" ADD CONSTRAINT "FK_008670f4d9fbbaa966f3bbb9e7d" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" ADD CONSTRAINT "FK_c4404a2ee605249b508c623e68f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "photos" DROP CONSTRAINT "FK_c4404a2ee605249b508c623e68f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" DROP CONSTRAINT "FK_008670f4d9fbbaa966f3bbb9e7d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "moments" DROP CONSTRAINT "FK_844d564a24fa9f2506810efec9f"`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "photos"."original_key" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "photos"."user_id" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "photos"."moment_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "photos" ADD CONSTRAINT "FK_c4404a2ee605249b508c623e68f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "photos" ADD CONSTRAINT "FK_008670f4d9fbbaa966f3bbb9e7d" FOREIGN KEY ("moment_id") REFERENCES "moments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "moments"."ended_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "moments"."started_at" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "moments"."title" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "moments"."user_id" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "moments" ADD CONSTRAINT "FK_844d564a24fa9f2506810efec9f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "users"."password" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "users"."email" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "photos" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "moments" IS NULL`);
    await queryRunner.query(`COMMENT ON TABLE "users" IS NULL`);
  }
}
