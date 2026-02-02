import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminAndAccountTypeToUsers1706808000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add is_admin column
    await queryRunner.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false
    `);

    // Add account_type column (automatic, manual, etc)
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "account_type" varchar(50) DEFAULT 'manual'
    `);

    // Create index for quick lookups
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_is_admin" ON "users"("is_admin")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_users_account_type" ON "users"("account_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_account_type"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_is_admin"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "account_type"
    `);

    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "is_admin"
    `);
  }
}
