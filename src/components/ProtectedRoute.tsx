import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiresPremium?: boolean; // New prop for premium-only routes
}

export const ProtectedRoute = ({ children, requiresPremium = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isPaid, isTrial, isLoading: subLoading } = useSubscription();

  // Show loading spinner while checking auth or subscription
  if (authLoading || subLoading) {
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

  // Check premium requirement
  if (requiresPremium && !isPaid && !isTrial) {
    return <Navigate to="/pricing" replace />;
  }

  return <>{children}</>;
};
