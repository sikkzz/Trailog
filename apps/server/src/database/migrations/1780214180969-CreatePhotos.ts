import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePhotos1780214180969 implements MigrationInterface {
  name = 'CreatePhotos1780214180969';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "photos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "moment_id" uuid NOT NULL, "user_id" uuid NOT NULL, "original_key" character varying(512) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5220c45b8e32d49d767b9b3d725" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_008670f4d9fbbaa966f3bbb9e7" ON "photos"  ("moment_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c4404a2ee605249b508c623e68" ON "photos"  ("user_id") `,
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
    await queryRunner.query(`DROP INDEX "public"."IDX_c4404a2ee605249b508c623e68"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_008670f4d9fbbaa966f3bbb9e7"`);
    await queryRunner.query(`DROP TABLE "photos"`);
  }
}
