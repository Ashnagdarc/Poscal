export class SubscriptionResponseDto {
  payment_status: 'free' | 'paid' | 'trial' | 'expired';
  subscription_tier: 'free' | 'premium' | 'pro';
  expires_at: Date | null;
  trial_ends_at: Date | null;
  is_active: boolean;
}
