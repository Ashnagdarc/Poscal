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

@Module({
  imports: [
    TypeOrmModule.forFeature([AppSetting, AppUpdate]),
    AuthModule,
  ],
  controllers: [UpdatesController, FeatureFlagController, PublicFeatureFlagController, IngestorHealthController],
  providers: [UpdatesService, FeatureFlagService, IngestorHealthService],
  exports: [TypeOrmModule, UpdatesService, FeatureFlagService, IngestorHealthService],
})
export class SystemModule {}
