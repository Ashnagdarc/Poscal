import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from './entities/app-setting.entity';
import { AppUpdate } from './entities/app-update.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting, AppUpdate])],
  exports: [TypeOrmModule],
})
export class SystemModule {}
