import 'crypto'; // Ensure crypto is available globally for TypeORM
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './auth/auth.module';
import { TradingModule } from './trading/trading.module';
import { PaymentsModule } from './payments/payments.module';
import { PricesModule } from './prices/prices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SystemModule } from './system/system.module';
import { HealthController } from './health.controller';
import { getDatabaseConfig } from './config/database.config';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database configuration
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Feature modules
    AuthModule,
    TradingModule,
    PaymentsModule,
    PricesModule,
    NotificationsModule,
    SystemModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
