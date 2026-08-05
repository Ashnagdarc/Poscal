import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAdmin } from '@/hooks/use-admin';
import { usePaidLock } from '@/hooks/use-paid-lock';
import { isClientEmailVerificationRequired } from '@/lib/emailVerificationClient';

// Feature: honor admin-controlled paid lock. When enabled, routes marked as `requiresPremium` are enforced.
// Fail-open: payment wall stays off until an admin turns the lock on (and on fetch errors/timeouts).

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresPremium?: boolean;
  requiresAdmin?: boolean;
}

const buildSignInRedirect = (pathname: string, search: string, reason: string) => {
  const returnTo = `${pathname}${search || ""}` || "/";
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  params.set("reason", reason);
  return `/signin?${params.toString()}`;
};

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
  // Soft default OFF via Vite env mirror — never query Convex for this so a
  // missing/undeployed authSettings:getVerificationPolicy cannot crash the app.
  const requireEmailVerification = isClientEmailVerificationRequired();

  // Show loading spinner while checking auth or subscription
  if (authLoading || subLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <p className="font-display text-sm text-muted-foreground">Loading Poscal…</p>
        </div>
      </div>
    );
  }

  // Check authentication first — preserve intent (MC-006 / EB-003).
  if (!user) {
    const reason =
      location.pathname.startsWith("/journal") ? "journal"
        : "session";
    return (
      <Navigate
        to={buildSignInRedirect(location.pathname, location.search, reason)}
        replace
        state={{ from: `${location.pathname}${location.search}`, reason }}
      />
    );
  }

  // Hard email gate only when Convex env REQUIRE_EMAIL_VERIFICATION is on (MC-010).
  // Soft mode (default): verified and unverified users both get full app access.
  if (requireEmailVerification && !user.email_verified) {
    return (
      <Navigate
        to="/verify-email"
        replace
        state={{
          email: user.email || undefined,
          returnTo: `${location.pathname}${location.search}` || "/journal",
        }}
      />
    );
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
