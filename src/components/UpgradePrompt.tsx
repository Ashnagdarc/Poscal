import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-b from-background to-secondary/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">{title || `Unlock ${feature}`}</h3>
        </div>
        <Badge variant="outline" className="border-primary/40 text-primary">Premium</Badge>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">
        {description || `Upgrade to access ${feature} and unlock your full trading workflow.`}
      </p>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background/60 p-3">
        <div>
          <p className="text-xs text-muted-foreground">Starting at</p>
          <p className="text-2xl font-bold">₦3,000/mo</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          Secure Paystack checkout
        </div>
      </div>

      <Button
        onClick={handleUpgrade}
        size="lg"
        className="mt-4 w-full gap-2"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
};

/**
 * Usage Examples:
 *
 * // Basic usage
 * <UpgradePrompt />
 *
 * // Custom feature name
 * <UpgradePrompt feature="unlimited journal entries" />
 *
 * // Full customization
 * <UpgradePrompt
 *   title="Ready to go Pro?"
 *   description="Get access to MT5 integration and API access for advanced traders"
 *   cta="Upgrade to Pro"
 *   tier="pro"
 * />
 */
