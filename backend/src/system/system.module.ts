import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './entities/app-setting.entity';
import { AppUpdate } from './entities/app-update.entity';
import { UpdatesController } from './updates.controller';
import { UpdatesService } from './updates.service';
import { FeatureFlagController } from './feature-flag.controller';
import { PublicFeatureFlagController } from './public-feature-flag.controller';
import { FeatureFlagService } from './feature-flag.service';
import { AuthModule } from '../auth/auth.module';
import { IngestorHealthController } from './ingestor-health.controller';
import { IngestorHealthService } from './ingestor-health.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { User } from '../auth/entities/user.entity';
import { Payment } from '../payments/entities/payment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AppSetting, AppUpdate, User, Payment]),
    AuthModule,
  ],
  controllers: [
    UpdatesController,
    FeatureFlagController,
    PublicFeatureFlagController,
    IngestorHealthController,
    AdminUsersController,
  ],
  providers: [UpdatesService, FeatureFlagService, IngestorHealthService, AdminUsersService],
  exports: [TypeOrmModule, UpdatesService, FeatureFlagService, IngestorHealthService, AdminUsersService],
})
export class SystemModule {}
