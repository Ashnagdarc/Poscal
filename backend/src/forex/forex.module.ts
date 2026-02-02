import { Module } from '@nestjs/common';
import { ForexGateway } from './forex.gateway';

@Module({
  providers: [ForexGateway],
})
export class ForexModule {}
