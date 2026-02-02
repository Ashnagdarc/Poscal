import 'crypto'; // Ensure crypto is available globally for TypeORM
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
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

    // Static serving for uploads
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
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
    // Storage is a provider-only module; imported where needed
  ],
  controllers: [HealthController],
})
export class AppModule {}
