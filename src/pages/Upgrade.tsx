import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PaymentModal } from '@/components/PaymentModal';
import { useAuth } from '@/contexts/AuthContext';

const UpgradePage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

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

    // Open modal once user is present
    setShowModal(true);
  }, [user]);

  return (
    <>
      <PaymentModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          navigate(redirectPath);
        }}
        tier={tierParam}
        redirectPath={redirectPath}
      />
      {/* In case modal cannot render, show fallback link */}
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Upgrade</h2>
          <p className="mt-2 text-sm text-muted-foreground">Opening payment dialog…</p>
        </div>
      </div>
    </>
  );
};

export default UpgradePage;
