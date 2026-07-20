import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MONTHLY_PLAN } from '@/lib/pricing';
import { ArrowRight, Crown, ShieldCheck } from 'lucide-react';

interface UpgradePromptProps {
  feature?: string;
  title?: string;
  description?: string;
  cta?: string;
  tier?: 'premium' | 'pro';
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature = 'this feature',
  title,
  description,
  cta = 'Upgrade Now',
  tier = 'premium',
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleUpgrade = () => {
    if (!user) {
      navigate('/signin');
      return;
    }

    const redirectPath = encodeURIComponent(window.location.pathname || '/');
    navigate(`/upgrade?tier=${tier}&redirectPath=${redirectPath}`);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/20 bg-accent/40 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-brand" />
          <h3 className="font-display text-xl font-bold text-foreground">
            {title || `Unlock ${feature}`}
          </h3>
        </div>
        <Badge variant="outline" className="border-brand/40 text-brand">
          Premium
        </Badge>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {description || `Upgrade to access ${feature} and unlock your full trading workflow.`}
      </p>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background/60 p-3">
        <div>
          <p className="text-xs text-muted-foreground">Starting at</p>
          <p className="font-display text-2xl font-bold text-foreground">
            {MONTHLY_PLAN.displayPrice}
            {MONTHLY_PLAN.periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Secure Paystack checkout
        </div>
      </div>

      <Button onClick={handleUpgrade} size="lg" className="mt-4 w-full gap-2 bg-brand text-brand-foreground hover:bg-brand/90">
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
