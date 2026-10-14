import { useQuery } from 'convex/react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/use-admin';
import { isClientEmailVerificationRequired } from '@/lib/emailVerificationClient';
import { api } from '../../convex/_generated/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
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
  requiresAdmin = false,
}: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const location = useLocation();
  // Prefer Convex server policy when available so UI matches API hard-gates.
  // Fall back to Vite mirror while the query loads / if it errors.
  const verificationPolicy = useQuery(api.authSettings.getVerificationPolicy, {});
  const requireEmailVerification =
    verificationPolicy?.requireEmailVerification ?? isClientEmailVerificationRequired();

  // Show loading spinner while checking auth or subscription
  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
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

  return <>{children}</>;
};
