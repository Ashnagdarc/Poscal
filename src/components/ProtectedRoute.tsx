import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
    (async () => {
      try {
        // Read directly from Supabase to avoid CORS when developing locally
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'paid_lock_enabled')
          .limit(1)
          .maybeSingle();
        if (error) {
          console.warn('Could not fetch paid lock flag (supabase)', error);
          if (mounted) setPaidLockEnabled(false);
          return;
        }
        const enabled = data?.value?.enabled === true;
        if (mounted) setPaidLockEnabled(!!enabled);
      } catch (err) {
        console.warn('Could not fetch paid lock flag', err);
        if (mounted) setPaidLockEnabled(false);
      }
    })();
    return () => { mounted = false; };
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
