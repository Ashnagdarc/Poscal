import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRevenuecatFieldsToUsers1776160440000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'revenue_cat_user_id',
        type: 'varchar',
        length: '255',
        isNullable: true,
        isUnique: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'subscription_tier',
        type: 'varchar',
        length: '50',
        default: "'free'",
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'subscription_expires_at',
        type: 'timestamp with time zone',
        isNullable: true,
      }),
    );

    // Create index on revenue_cat_user_id for faster lookups
    await queryRunner.query(
      `CREATE INDEX IDX_users_revenue_cat_user_id ON users(revenue_cat_user_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('users', 'IDX_users_revenue_cat_user_id');
    await queryRunner.dropColumn('users', 'subscription_expires_at');
    await queryRunner.dropColumn('users', 'subscription_tier');
    await queryRunner.dropColumn('users', 'revenue_cat_user_id');
  }
}
