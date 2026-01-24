import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscriptionApi } from '@/lib/api';

// Subscription tier types
export type SubscriptionTier = 'free' | 'premium' | 'pro';
export type PaymentStatus = 'free' | 'paid' | 'trial' | 'expired';

// Feature access map - defines which tiers can access which features
const FEATURE_ACCESS_MAP: Record<string, SubscriptionTier[]> = {
  journal_unlimited: ['premium', 'pro'],
  signals_take: ['premium', 'pro'],
  history_unlimited: ['premium', 'pro'],
  export_csv: ['premium', 'pro'],
  advanced_analytics: ['pro'],
  api_access: ['pro'],
};

interface SubscriptionDetails {
  paymentStatus: PaymentStatus;
  subscriptionTier: SubscriptionTier;
  expiresAt: Date | null;
  trialEndsAt: Date | null;
  isActive: boolean;
}

interface SubscriptionContextType {
  // Quick access properties
  isPaid: boolean;
  isTrial: boolean;
  isLoading: boolean;
  
  // Detailed subscription info
  subscriptionTier: SubscriptionTier;
  paymentStatus: PaymentStatus;
  expiresAt: Date | null;
  trialEndsAt: Date | null;
  
  // Methods
  checkFeatureAccess: (feature: string) => boolean;
  refreshSubscription: () => Promise<void>;
  
  // Helper getters
  daysUntilExpiry: number | null;
  daysUntilTrialEnd: number | null;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionDetails, setSubscriptionDetails] = useState<SubscriptionDetails>({
    paymentStatus: 'free',
    subscriptionTier: 'free',
    expiresAt: null,
    trialEndsAt: null,
    isActive: false,
  });

  // Fetch user's subscription details from database
  const fetchSubscriptionDetails = async () => {
    if (!user) {
      setSubscriptionDetails({
        paymentStatus: 'free',
        subscriptionTier: 'free',
        expiresAt: null,
        trialEndsAt: null,
        isActive: false,
      });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      // Call the subscription API
      const data = await subscriptionApi.getDetails();

      if (data) {
        setSubscriptionDetails({
          paymentStatus: data.payment_status || 'free',
          subscriptionTier: data.subscription_tier || 'free',
          expiresAt: data.expires_at ? new Date(data.expires_at) : null,
          trialEndsAt: data.trial_ends_at ? new Date(data.trial_ends_at) : null,
          isActive: data.is_active || false,
        });
      }
    } catch (error) {
      console.error('Unexpected error fetching subscription:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load subscription on mount and when user changes
  useEffect(() => {
    fetchSubscriptionDetails();
  }, [user?.id]);

  // Check if user can access a specific feature
  const checkFeatureAccess = (feature: string): boolean => {
    // If no user, deny access
    if (!user) return false;

    // If not an active subscription, deny access
    if (!subscriptionDetails.isActive) {
      return false;
    }

    // Check if feature exists in access map
    const allowedTiers = FEATURE_ACCESS_MAP[feature];
    if (!allowedTiers) {
      console.warn(`Feature "${feature}" not found in access map`);
      return false;
    }

    // Check if user's tier is in the allowed tiers
    return allowedTiers.includes(subscriptionDetails.subscriptionTier);
  };

  // Manually refresh subscription (useful after payment)
  const refreshSubscription = async () => {
    await fetchSubscriptionDetails();
  };

  // Calculate days until subscription expires
  const daysUntilExpiry = subscriptionDetails.expiresAt
    ? Math.ceil(
        (subscriptionDetails.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Calculate days until trial ends
  const daysUntilTrialEnd = subscriptionDetails.trialEndsAt
    ? Math.ceil(
        (subscriptionDetails.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const value: SubscriptionContextType = {
    // Quick access
    isPaid: subscriptionDetails.isActive && subscriptionDetails.paymentStatus === 'paid',
    isTrial: subscriptionDetails.paymentStatus === 'trial',
    isLoading,

    // Details
    subscriptionTier: subscriptionDetails.subscriptionTier,
    paymentStatus: subscriptionDetails.paymentStatus,
    expiresAt: subscriptionDetails.expiresAt,
    trialEndsAt: subscriptionDetails.trialEndsAt,

    // Methods
    checkFeatureAccess,
    refreshSubscription,

    // Helpers
    daysUntilExpiry,
    daysUntilTrialEnd,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Custom hook to use subscription context
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

// Helper hook for feature gating in components
export const useFeatureGate = (feature: string) => {
  const { checkFeatureAccess, subscriptionTier, isPaid, isLoading } = useSubscription();
  
  return {
    hasAccess: checkFeatureAccess(feature),
    requiresUpgrade: !checkFeatureAccess(feature),
    tier: subscriptionTier,
    isPaid,
    isLoading,
  };
};
