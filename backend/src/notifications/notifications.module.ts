import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PushSubscription } from './entities/push-subscription.entity';
import { PushNotificationQueue } from './entities/push-notification-queue.entity';
import { EmailQueue } from './entities/email-queue.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription, PushNotificationQueue, EmailQueue]), AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [TypeOrmModule, NotificationsService],
})
export class NotificationsModule {}
