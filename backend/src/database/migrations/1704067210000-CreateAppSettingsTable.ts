import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppSettingsTable1704067210000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_settings" (
        "key" varchar(100) PRIMARY KEY,
        "value" text,
        "description" text,
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_settings"`);
  }
}
