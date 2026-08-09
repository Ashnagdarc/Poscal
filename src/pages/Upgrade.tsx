import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PaymentModal } from "@/components/PaymentModal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { isPaymentsEnabled } from "@/lib/paymentsConfig";

const UpgradePage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const paymentsEnabled = isPaymentsEnabled();

  const qp = new URLSearchParams(location.search);
  const tierParam = (qp.get("tier") as "premium" | "pro") || "premium";
  const redirectPath = qp.get("redirectPath") || "/";

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const next = `${location.pathname}${location.search}`;
      navigate(
        `/signin?returnTo=${encodeURIComponent(next)}&next=${encodeURIComponent(next)}`,
      );
      return;
    }

    setShowModal(true);
  }, [user, authLoading, location.pathname, location.search, navigate]);

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
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h2 className="font-display text-lg font-semibold">
            {paymentsEnabled ? "Upgrade" : "Checkout paused"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {paymentsEnabled
              ? "Opening payment dialog…"
              : "Paystack billing is temporarily off. You can keep using the app."}
          </p>
          {!paymentsEnabled && (
            <Button className="mt-6 w-full rounded-xl" onClick={() => navigate(redirectPath)}>
              Back to app
            </Button>
          )}
        </div>
      </div>
    </>
  );
};

export default UpgradePage;
