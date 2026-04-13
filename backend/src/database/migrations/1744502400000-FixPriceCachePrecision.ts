import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPriceCachePrecision1744502400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Increase precision from numeric(10,5) to numeric(15,6).
    // The original precision (max 99999.99999) is too tight for large indices
    // (JP225 ~38 000, NAS100 ~18 000) and allows no headroom for future extremes.
    await queryRunner.query(`
      ALTER TABLE price_cache
        ALTER COLUMN bid_price TYPE numeric(15,6),
        ALTER COLUMN ask_price TYPE numeric(15,6),
        ALTER COLUMN mid_price TYPE numeric(15,6)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE price_cache
        ALTER COLUMN bid_price TYPE numeric(10,5),
        ALTER COLUMN ask_price TYPE numeric(10,5),
        ALTER COLUMN mid_price TYPE numeric(10,5)
    `);
  }
}
