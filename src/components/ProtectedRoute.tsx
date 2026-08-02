import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAdmin } from '@/hooks/use-admin';
import { usePaidLock } from '@/hooks/use-paid-lock';

// Feature: honor admin-controlled paid lock. When enabled, routes marked as `requiresPremium` are enforced.
// Fail-open: payment wall stays off until an admin turns the lock on (and on fetch errors/timeouts).

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresPremium?: boolean;
  requiresAdmin?: boolean;
}

export const ProtectedRoute = ({
  children,
  requiresPremium = false,
  requiresAdmin = false,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isPaid, isTrial, isLoading: subLoading } = useSubscription();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { paidLockEnabled } = usePaidLock();
  const location = useLocation();

  // Show loading spinner while checking auth or subscription
  if (authLoading || subLoading || adminLoading) {
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

  if (requiresAdmin && !isAdmin) {
    return <Navigate to="/settings" replace />;
  }

  // Enforce only if route requires premium AND admin has enabled paid lock.
  if (requiresPremium && paidLockEnabled && !isPaid && !isTrial) {
    const redirectPath = encodeURIComponent(location.pathname || '/');
    return <Navigate to={`/upgrade?tier=premium&redirectPath=${redirectPath}`} replace />;
  }

  return <>{children}</>;
};
