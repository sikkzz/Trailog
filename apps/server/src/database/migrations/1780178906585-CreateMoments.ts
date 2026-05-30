import type { MigrationInterface, QueryRunner } from 'typeorm';

// Moments 테이블 생성 마이그레이션.
//
// 변경:
// - CREATE TABLE moments (id uuid PK, user_id uuid FK, title varchar(255),
//   started_at/ended_at timestamptz NULL, timestamps NOT NULL DEFAULT now())
// - CREATE INDEX on (user_id) — "본인 moment 리스트" 쿼리 가속
// - FK user_id → users(id) ON DELETE CASCADE — 사용자 탈퇴 시 자동 cleanup
//
// 학습 포인트:
// - varchar(255) title — 여행/단발 무관 자유 표현. 한국어 80자 정도 들어감.
// - started_at/ended_at nullable — 단발 방문(카페/식당)은 둘 다 null 가능.
// - ON DELETE CASCADE — 사용자 데이터 정리 일관성. Phase 후속 회원 탈퇴 흐름에 도움.
//
// Reversibility (down): DROP CONSTRAINT → DROP INDEX → DROP TABLE 순서 (의존성 역순).

export class CreateMoments1780178906585 implements MigrationInterface {
  name = 'CreateMoments1780178906585';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "moments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "started_at" TIMESTAMP WITH TIME ZONE, "ended_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e37a182a29676eb8aa410bec12" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_844d564a24fa9f2506810efec9" ON "moments" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "moments" ADD CONSTRAINT "FK_844d564a24fa9f2506810efec9f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "moments" DROP CONSTRAINT "FK_844d564a24fa9f2506810efec9f"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_844d564a24fa9f2506810efec9"`);
    await queryRunner.query(`DROP TABLE "moments"`);
  }
}
