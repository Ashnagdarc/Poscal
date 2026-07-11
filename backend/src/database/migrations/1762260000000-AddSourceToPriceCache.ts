import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSourceToPriceCache1762260000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE price_cache
      ADD COLUMN IF NOT EXISTS source varchar(32) NOT NULL DEFAULT 'unknown'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE price_cache
      DROP COLUMN IF EXISTS source
    `);
  }
}
