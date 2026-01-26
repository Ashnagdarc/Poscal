import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useEffect, useState } from 'react';
import { featureFlagApi } from '@/lib/api';

// Feature: honor admin-controlled paid lock. When enabled, routes marked as `requiresPremium` are enforced.

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresPremium?: boolean; // New prop for premium-only routes
}

export const ProtectedRoute = ({ children, requiresPremium = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isPaid, isTrial, isLoading: subLoading } = useSubscription();
  const [paidLockEnabled, setPaidLockEnabled] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    (async () => {
      try {
        const enabled = await featureFlagApi.getPaidLock();
        if (mounted) setPaidLockEnabled(!!enabled);
      } catch (err) {
        console.warn('Could not fetch paid lock flag', err);
        if (mounted) setPaidLockEnabled(false);
      }
    })();

    // Fallback: if API doesn't respond within 5 seconds, default to false
    timeoutId = setTimeout(() => {
      if (mounted && paidLockEnabled === null) {
        console.warn('Paid lock API timeout, defaulting to false');
        setPaidLockEnabled(false);
      }
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  // Show loading spinner while checking auth or subscription
  if (authLoading || subLoading || paidLockEnabled === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Check authentication first
  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  // Check premium requirement. Enforce only if route requires premium AND admin has enabled paid lock.
  if (requiresPremium && paidLockEnabled && !isPaid && !isTrial) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
};
