import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { PushNotificationQueue } from './entities/push-notification-queue.entity';
import { EmailQueue } from './entities/email-queue.entity';
import { CreatePushSubscriptionDto, CreatePushNotificationDto, CreateEmailDto } from './dto/notifications.dto';
import { UpdateNotificationStatusDto } from './dto/update-notification-status.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(PushSubscription)
    private pushSubscriptionRepository: Repository<PushSubscription>,
    @InjectRepository(PushNotificationQueue)
    private pushQueueRepository: Repository<PushNotificationQueue>,
    @InjectRepository(EmailQueue)
    private emailQueueRepository: Repository<EmailQueue>,
  ) {}

  // Push Subscriptions
  async createSubscription(dto: CreatePushSubscriptionDto): Promise<PushSubscription> {
    try {
      // Upsert by endpoint to avoid unique constraint violations
      const existing = await this.pushSubscriptionRepository.findOne({ where: { endpoint: dto.endpoint } });

      if (existing) {
        existing.user_id = dto.user_id ?? existing.user_id;
        existing.p256dh_key = dto.p256dh_key;
        existing.auth_key = dto.auth_key;
        existing.user_agent = dto.user_agent ?? existing.user_agent;
        existing.is_active = true;
        return await this.pushSubscriptionRepository.save(existing);
      }

      const subscription = this.pushSubscriptionRepository.create(dto);
      return await this.pushSubscriptionRepository.save(subscription);
    } catch (error) {
      const err: any = error;
      console.error('[push] Error creating subscription:', err?.message || err);
      throw err;
    }
  }

  async getUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    return await this.pushSubscriptionRepository.find({
      where: { user_id: userId, is_active: true },
    });
  }

  async getAllActiveSubscriptions(): Promise<PushSubscription[]> {
    return await this.pushSubscriptionRepository.find({
      where: { is_active: true },
    });
  }

  async deleteSubscription(id: string): Promise<void> {
    await this.pushSubscriptionRepository.delete(id);
  }

  // Push Notifications
  async queuePushNotification(dto: CreatePushNotificationDto): Promise<PushNotificationQueue> {
    const notification = this.pushQueueRepository.create(dto);
    return await this.pushQueueRepository.save(notification);
  }

  async getPendingPushNotifications(limit: number = 100): Promise<PushNotificationQueue[]> {
    const now = new Date();
    return await this.pushQueueRepository
      .createQueryBuilder('notification')
      .where('notification.status = :status', { status: 'pending' })
      .andWhere('(notification.scheduled_for <= :now OR notification.scheduled_for IS NULL)', { now })
      .orderBy('notification.created_at', 'ASC')
      .take(limit)
      .getMany();
  }

  async updatePushNotification(id: string, status: string, errorMessage?: string): Promise<void> {
    const notification = await this.pushQueueRepository.findOne({ where: { id } });
    if (notification) {
      notification.status = status;
      notification.attempts += 1;
      if (errorMessage) {
        notification.error_message = errorMessage;
      }
      if (status === 'sent') {
        notification.sent_at = new Date();
      }
      await this.pushQueueRepository.save(notification);
    }
  }

  async updateNotificationStatus(id: string, dto: UpdateNotificationStatusDto): Promise<PushNotificationQueue | null> {
    const updateData: Partial<PushNotificationQueue> = {
      status: dto.status,
      updated_at: new Date(),
    };

    if (dto.sent_at) {
      updateData.sent_at = new Date(dto.sent_at);
    }

    if (dto.error_message) {
      updateData.error_message = dto.error_message;
    }

    await this.pushQueueRepository
      .createQueryBuilder()
      .update(PushNotificationQueue)
      .set({
        ...updateData,
        attempts: () => 'attempts + 1',
      })
      .where('id = :id', { id })
      .execute();

    return await this.pushQueueRepository.findOne({ where: { id } });
  }

  async batchUpdateNotificationStatus(ids: string[], status: string): Promise<void> {
    await this.pushQueueRepository
      .createQueryBuilder()
      .update(PushNotificationQueue)
      .set({
        status,
        sent_at: status === 'sent' ? new Date() : null,
        updated_at: new Date(),
      })
      .whereInIds(ids)
      .execute();
  }

  // Emails
  async queueEmail(dto: CreateEmailDto): Promise<EmailQueue> {
    const email = this.emailQueueRepository.create(dto);
    return await this.emailQueueRepository.save(email);
  }

  async getPendingEmails(limit: number = 100): Promise<EmailQueue[]> {
    const now = new Date();
    return await this.emailQueueRepository
      .createQueryBuilder('email')
      .where('email.status = :status', { status: 'pending' })
      .andWhere('(email.scheduled_for <= :now OR email.scheduled_for IS NULL)', { now })
      .orderBy('email.created_at', 'ASC')
      .take(limit)
      .getMany();
  }

  async updateEmail(id: string, status: string, errorMessage?: string): Promise<void> {
    const email = await this.emailQueueRepository.findOne({ where: { id } });
    if (email) {
      email.status = status;
      email.attempts += 1;
      if (errorMessage) {
        email.error_message = errorMessage;
      }
      if (status === 'sent') {
        email.sent_at = new Date();
      }
      await this.emailQueueRepository.save(email);
    }
  }

  async getUserNotifications(userId: string): Promise<PushNotificationQueue[]> {
    return await this.pushQueueRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      take: 50,
    });
  }
}
