import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

interface RevenueCatEntitlement {
  entitlement_id: string;
  expires_date: string | null;
  purchase_date: string;
  product_identifier: string;
  active: boolean;
}

interface RevenueCatSubscriber {
  subscriber_id: string;
  original_app_user_id: string;
  first_seen: string;
  last_seen: string;
  management_url: string | null;
  subscriptions: Record<string, any>;
  entitlements: Record<string, RevenueCatEntitlement>;
  non_subscriptions: Record<string, any[]>;
}

interface UserEntitlement {
  subscriptionTier: 'free' | 'premium' | 'pro';
  entitlements: string[];
  expiresAt: Date | null;
  isActive: boolean;
}

@Injectable()
export class RevenuecatService {
  private readonly logger = new Logger('RevenuecatService');
  private readonly httpClient: AxiosInstance;
  private readonly revenuecatApiKey: string;
  private readonly revenuecatWebhookSecret: string;

  constructor(private configService: ConfigService) {
    this.revenuecatApiKey = this.configService.get<string>('REVENUECAT_API_KEY', '');
    this.revenuecatWebhookSecret = this.configService.get<string>(
      'REVENUECAT_WEBHOOK_SECRET',
      '',
    );

    this.httpClient = axios.create({
      baseURL: 'https://api.revenuecat.com/v1',
      headers: {
        'Authorization': `Bearer ${this.revenuecatApiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch subscriber data from RevenueCat by user ID
   */
  async getSubscriber(userId: string): Promise<RevenueCatSubscriber | null> {
    try {
      const response = await this.httpClient.get<{ subscriber: RevenueCatSubscriber }>(
        `/subscribers/${userId}`,
      );
      return response.data.subscriber;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        this.logger.warn(`Subscriber not found in RevenueCat: ${userId}`);
        return null;
      }
      this.logger.error(`Failed to fetch subscriber ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Map RevenueCat entitlements to application subscription tier
   */
  mapEntitlementsToTier(entitlements: Record<string, RevenueCatEntitlement>): UserEntitlement {
    // Find active entitlements
    const activeEntitlements = Object.entries(entitlements)
      .filter(([_, ent]) => ent.active)
      .map(([key]) => key);

    // Determine tier based on entitlements (customize based on your RevenueCat setup)
    let subscriptionTier: 'free' | 'premium' | 'pro' = 'free';
    let expiresAt: Date | null = null;

    if (activeEntitlements.includes('pro_access')) {
      subscriptionTier = 'pro';
      const proEnt = entitlements['pro_access'];
      if (proEnt?.expires_date) {
        expiresAt = new Date(proEnt.expires_date);
      }
    } else if (activeEntitlements.includes('premium_access')) {
      subscriptionTier = 'premium';
      const premiumEnt = entitlements['premium_access'];
      if (premiumEnt?.expires_date) {
        expiresAt = new Date(premiumEnt.expires_date);
      }
    }

    return {
      subscriptionTier,
      entitlements: activeEntitlements,
      expiresAt,
      isActive: activeEntitlements.length > 0,
    };
  }

  /**
   * Get user entitlements (maps RevenueCat data to app model)
   */
  async getUserEntitlements(userId: string): Promise<UserEntitlement> {
    try {
      const subscriber = await this.getSubscriber(userId);

      if (!subscriber) {
        // User hasn't made any purchases yet
        return {
          subscriptionTier: 'free',
          entitlements: [],
          expiresAt: null,
          isActive: false,
        };
      }

      return this.mapEntitlementsToTier(subscriber.entitlements);
    } catch (error) {
      this.logger.error(`Failed to get entitlements for user ${userId}:`, error);
      // Fail gracefully - default to free tier
      return {
        subscriptionTier: 'free',
        entitlements: [],
        expiresAt: null,
        isActive: false,
      };
    }
  }

  /**
   * Verify webhook signature from RevenueCat
   * @see https://docs.revenuecat.com/docs/webhooks
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    if (!this.revenuecatWebhookSecret) {
      this.logger.warn('REVENUECAT_WEBHOOK_SECRET not configured');
      return false;
    }

    const hash = crypto
      .createHmac('sha256', this.revenuecatWebhookSecret)
      .update(body)
      .digest('hex');

    const isValid = hash === signature;
    if (!isValid) {
      this.logger.warn('Invalid webhook signature');
    }
    return isValid;
  }

  /**
   * Handle webhook event from RevenueCat
   */
  async handleWebhookEvent(event: any): Promise<void> {
    try {
      const eventType = event.event?.type;
      const userId = event.event?.app_user_id;

      this.logger.log(`Processing RevenueCat webhook: ${eventType} for user ${userId}`);

      // Webhook types we care about:
      // - INITIAL_PURCHASE
      // - RENEWAL
      // - CANCELLATION
      // - EXPIRATION
      // - BILLING_ISSUE

      // For now, just log. In phase 5, we'll cache invalidation here.
      // The frontend will call GET /subscriptions/entitlements which will fetch fresh data.
    } catch (error) {
      this.logger.error('Failed to handle webhook event:', error);
      throw error;
    }
  }
}
