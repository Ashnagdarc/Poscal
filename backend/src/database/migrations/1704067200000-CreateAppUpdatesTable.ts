import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppUpdatesTable1704067200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "app_updates" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    
    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_app_updates_is_active" ON "app_updates" ("is_active")
    `);
    
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_app_updates_created_at" ON "app_updates" ("created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "app_updates"`);
  }
}
