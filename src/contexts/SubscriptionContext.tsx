import React, { createContext, useContext } from 'react';
import { useConvexAuth } from '@convex-dev/auth/react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

// Subscription tier types
export type SubscriptionTier = 'free' | 'premium' | 'pro';
export type PaymentStatus = 'free' | 'paid' | 'trial' | 'expired';

// Feature access map - defines which tiers can access which features
const FEATURE_ACCESS_MAP: Record<string, SubscriptionTier[]> = {
  journal_unlimited: ['premium', 'pro'],
  signals_take: ['premium', 'pro'],
  news_feed: ['premium', 'pro'],
  history_unlimited: ['premium', 'pro'],
  export_csv: ['premium', 'pro'],
  advanced_analytics: ['pro'],
  api_access: ['pro'],
};

const asPaymentStatus = (value: string | undefined): PaymentStatus => {
  switch (value) {
    case 'free':
    case 'paid':
    case 'trial':
    case 'expired':
      return value;
    default:
      return 'free';
  }
};

const asSubscriptionTier = (value: string | undefined): SubscriptionTier => {
  switch (value) {
    case 'free':
    case 'premium':
    case 'pro':
      return value;
    default:
      return 'free';
  }
};

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

/**
 * Subscription state is derived from Convex Auth + `users.viewer` directly.
 * Do NOT call `useAuth` here: AuthContext HMR recreates that module's
 * createContext, which can leave this provider reading an empty context and
 * crash with "useAuth must be used within an AuthProvider" even when nested
 * under AuthProvider in App.tsx. The viewer query is shared/cached with Auth.
 */
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  // Same query key as AuthContext — Convex dedupes to one reactive subscription.
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : 'skip');

  const paymentStatus = asPaymentStatus(viewer?.paymentStatus);
  const subscriptionTier = asSubscriptionTier(viewer?.subscriptionTier);
  const expiresAt = viewer?.subscriptionExpiresAtMs
    ? new Date(viewer.subscriptionExpiresAtMs)
    : null;
  const trialEndsAt: Date | null = null;
  const hasUser = Boolean(viewer);
  const isActive = hasUser
    && subscriptionTier !== 'free'
    && paymentStatus !== 'expired';
  const isLoading = authLoading || (isAuthenticated && viewer === undefined);

  // Check if user can access a specific feature
  const checkFeatureAccess = (feature: string): boolean => {
    // If no user, deny access
    if (!hasUser) return false;

    // If not an active subscription, deny access
    if (!isActive) {
      return false;
    }

    // Check if feature exists in access map
    const allowedTiers = FEATURE_ACCESS_MAP[feature];
    if (!allowedTiers) {
      console.warn(`Feature "${feature}" not found in access map`);
      return false;
    }

    // Check if user's tier is in the allowed tiers
    return allowedTiers.includes(subscriptionTier);
  };

  // Viewer is reactive via Convex useQuery — payment sync patches update automatically.
  const refreshSubscription = async () => {
    // No-op: kept for PaymentModal / Settings call sites after verify/restore.
  };

  // Calculate days until subscription expires
  const daysUntilExpiry = expiresAt
    ? Math.ceil(
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Calculate days until trial ends
  const daysUntilTrialEnd = trialEndsAt
    ? Math.ceil(
        (trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  const value: SubscriptionContextType = {
    // Quick access
    isPaid: isActive && paymentStatus === 'paid',
    isTrial: paymentStatus === 'trial',
    isLoading,

    // Details
    subscriptionTier,
    paymentStatus,
    expiresAt,
    trialEndsAt,

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
