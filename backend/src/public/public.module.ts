import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [SystemModule],
  controllers: [PublicController],
})
export class PublicModule {}
