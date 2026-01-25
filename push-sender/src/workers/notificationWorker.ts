import webpush from 'web-push';
import { AxiosInstance } from 'axios';
import { loadNotificationWorkerConfig, NotificationWorkerConfig } from '../lib/config';
import { createNestApi } from '../lib/nestApi';
import { logger } from '../lib/logger';
import { withRetry } from '../lib/retry';
import { PushSubscription, QueuedNotification } from '../types';

interface CacheEntry {
  subscriptions: PushSubscription[];
  expiresAt: number;
}

interface Metrics {
  processed: number;
  sent: number;
  failed: number;
  cacheHits: number;
  cacheMisses: number;
}

const CACHE_TTL_MS = 5000;
const CACHE_KEY_ACTIVE = 'active';
const SEND_BATCH_SIZE = 50;
const METRICS_LOG_INTERVAL_MS = 60000;

export class NotificationWorker {
  private readonly config: NotificationWorkerConfig;
  private readonly nestApi: AxiosInstance;
  private readonly subscriptionCache = new Map<string, CacheEntry>();
  private readonly metrics: Metrics = {
    processed: 0,
    sent: 0,
    failed: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };
  private pollTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;

  constructor() {
    this.config = loadNotificationWorkerConfig();
    this.nestApi = createNestApi({
      baseUrl: this.config.nestApiUrl,
      serviceToken: this.config.serviceToken,
    });

    webpush.setVapidDetails(
      this.config.vapidSubject,
      this.config.vapidPublicKey,
      this.config.vapidPrivateKey,
    );
  }

  async start(): Promise<void> {
    logger.info('Starting notification worker', {
      pollIntervalMs: this.config.pollIntervalMs,
      backend: this.config.nestApiUrl,
    });

    await this.processQueue();

    this.pollTimer = setInterval(() => {
      void this.processQueue();
    }, this.config.pollIntervalMs);

    this.metricsTimer = setInterval(() => {
      this.logMetrics();
      this.evictExpiredCache();
    }, METRICS_LOG_INTERVAL_MS);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }

    this.subscriptionCache.clear();
  }

  private async processQueue(): Promise<void> {
    try {
      const notifications = await this.fetchPendingNotifications();
      if (notifications.length === 0) {
        logger.debug('No pending notifications');
        return;
      }

      this.metrics.processed += notifications.length;
      logger.info('Processing notifications', { pending: notifications.length });

      for (const notification of notifications) {
        const subscriptions = await this.resolveSubscriptions(notification);
        if (subscriptions.length === 0) {
          logger.warn('No subscriptions for notification', { notificationId: notification.id });
          await this.updateNotificationStatus(notification.id, 'failed', 'No active subscriptions');
          this.metrics.failed++;
          continue;
        }

        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < subscriptions.length; i += SEND_BATCH_SIZE) {
          const batch = subscriptions.slice(i, i + SEND_BATCH_SIZE);
          const results = await Promise.all(batch.map((sub) => this.sendToSubscription(sub, notification)));
          successCount += results.filter(Boolean).length;
          failureCount += results.filter((result) => !result).length;
        }

        this.metrics.sent += successCount;
        this.metrics.failed += failureCount;

        logger.info('Notification delivery summary', {
          notificationId: notification.id,
          title: notification.title,
          subscriptions: subscriptions.length,
          successCount,
          failureCount,
        });

        if (successCount > 0) {
          await this.updateNotificationStatus(notification.id, 'sent');
        } else {
          await this.updateNotificationStatus(notification.id, 'failed', 'All delivery attempts failed');
        }
      }
    } catch (error) {
      logger.error('Notification queue processing failed', { error: (error as Error).message });
    }
  }

  private async resolveSubscriptions(notification: QueuedNotification): Promise<PushSubscription[]> {
    if (notification.user_id) {
      logger.debug('Fetching user-specific subscriptions', { userId: notification.user_id });
      return this.getCachedSubscriptions(notification.user_id, () => this.fetchUserSubscriptions(notification.user_id!));
    }

    logger.debug('Fetching broadcast subscriptions');
    return this.getCachedSubscriptions(CACHE_KEY_ACTIVE, () => this.fetchActiveSubscriptions());
  }

  private async getCachedSubscriptions(
    cacheKey: string,
    fetcher: () => Promise<PushSubscription[]>,
  ): Promise<PushSubscription[]> {
    const now = Date.now();
    const cached = this.subscriptionCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      this.metrics.cacheHits++;
      return cached.subscriptions;
    }

    try {
      const subscriptions = await fetcher();
      this.metrics.cacheMisses++;
      this.subscriptionCache.set(cacheKey, {
        subscriptions,
        expiresAt: now + CACHE_TTL_MS,
      });
      return subscriptions;
    } catch (error) {
      logger.error('Failed to fetch subscriptions', { cacheKey, error: (error as Error).message });
      return [];
    }
  }

  private async fetchActiveSubscriptions(): Promise<PushSubscription[]> {
    const response = await withRetry(() => this.nestApi.get('/notifications/push/subscriptions/active'));
    return response.data || [];
  }

  private async fetchUserSubscriptions(userId: string): Promise<PushSubscription[]> {
    const response = await withRetry(() => this.nestApi.get(`/notifications/push/subscriptions/user/${userId}`));
    return response.data || [];
  }

  private async fetchPendingNotifications(limit = 100): Promise<QueuedNotification[]> {
    try {
      const response = await withRetry(() => this.nestApi.get('/notifications/push/pending', { params: { limit } }));
      return response.data || [];
    } catch (error) {
      logger.error('Failed to fetch pending notifications', { error: (error as Error).message });
      return [];
    }
  }

  private async updateNotificationStatus(
    id: string,
    status: 'sent' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
    try {
      await withRetry(() => this.nestApi.patch(`/notifications/push/${id}/status`, {
        status,
        sent_at: new Date().toISOString(),
        error_message: errorMessage,
      }));
    } catch (error) {
      logger.error('Failed to update notification status', { id, status, error: (error as Error).message });
    }
  }

  private async sendToSubscription(
    subscription: PushSubscription,
    notification: QueuedNotification,
  ): Promise<boolean> {
    try {
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        tag: notification.tag || 'general',
        icon: notification.icon || '/pwa-192x192.png',
        badge: '/favicon.png',
        url: notification.url,
        data: notification.data || {},
      });

      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh_key,
            auth: subscription.auth_key,
          },
        },
        payload,
      );

      return true;
    } catch (error: unknown) {
      const err = error as { statusCode?: number; message?: string };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        logger.warn('Subscription expired', { subscriptionId: subscription.id });
        return false;
      }

      logger.error('Failed to send push notification', {
        subscriptionId: subscription.id,
        error: err?.message || 'Unknown error',
      });
      return false;
    }
  }

  private logMetrics(): void {
    logger.info('Notification worker metrics', {
      processed: this.metrics.processed,
      sent: this.metrics.sent,
      failed: this.metrics.failed,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      cacheSize: this.subscriptionCache.size,
    });
  }

  private evictExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.subscriptionCache.entries()) {
      if (entry.expiresAt <= now) {
        this.subscriptionCache.delete(key);
      }
    }
  }
}
