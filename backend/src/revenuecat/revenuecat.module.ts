import { Module } from '@nestjs/common';
import { RevenuecatService } from './revenuecat.service';
import { RevenuecatWebhookController } from './revenuecat-webhook.controller';

@Module({
  controllers: [RevenuecatWebhookController],
  providers: [RevenuecatService],
  exports: [RevenuecatService],
})
export class RevenuecatModule {}
