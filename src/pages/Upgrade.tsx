import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { openRevenueCatCheckout } from '@/lib/revenuecat-checkout';

const UpgradePage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const revenueCatCheckoutUrl = import.meta.env.VITE_REVENUECAT_WEB_CHECKOUT_URL || '';

  // Read query params: ?tier=premium&redirectPath=/calculator
  const qp = new URLSearchParams(location.search);
  const tierParam = (qp.get('tier') as 'premium' | 'pro') || 'premium';
  const redirectPath = qp.get('redirectPath') || '/';

  useEffect(() => {
    // If user is not signed in, send them to signin with next back to this page
    if (!user) {
      const next = `${location.pathname}${location.search}`;
      navigate(`/signin?next=${encodeURIComponent(next)}`);
      return;
    }

    if (!revenueCatCheckoutUrl) {
      setError('RevenueCat checkout URL is not configured.');
      return;
    }

    const opened = openRevenueCatCheckout({
      checkoutUrl: revenueCatCheckoutUrl,
      userId: user.id,
      email: user.email,
      tier: tierParam,
    });

    if (!opened) {
      setError('Unable to open RevenueCat checkout.');
    }
  }, [user, revenueCatCheckoutUrl, tierParam]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Upgrade</h2>
        {error ? (
          <>
            <p className="mt-2 text-sm text-destructive">{error}</p>
            <button
              className="mt-4 text-sm underline"
              onClick={() => navigate(redirectPath)}
            >
              Go back
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Opening RevenueCat checkout…</p>
        )}
      </div>
    </div>
  );
};

export default UpgradePage;
