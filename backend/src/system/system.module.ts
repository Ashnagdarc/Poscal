import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './entities/app-setting.entity';
import { AppUpdate } from './entities/app-update.entity';
import { UpdatesController } from './updates.controller';
import { UpdatesService } from './updates.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, AppUpdate])],
  exports: [TypeOrmModule],
})
export class SystemModule {}

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, AppUpdate])],
  controllers: [UpdatesController],
  providers: [UpdatesService],
  exports: [TypeOrmModule],
})
export class SystemModule {}
