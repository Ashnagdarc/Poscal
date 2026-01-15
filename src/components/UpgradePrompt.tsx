import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PaymentModal } from './PaymentModal';
import { Trophy, Zap, ArrowRight } from 'lucide-react';

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
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleUpgrade = () => {
    if (!user) {
      navigate('/signin');
      return;
    }
    setShowPaymentModal(true);
  };

  return (
    <>
      <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent p-6 md:p-8">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-secondary/20 rounded-full blur-2xl -ml-8 -mb-8" />

        {/* Content */}
        <div className="relative space-y-4">
          {/* Icon and Badge */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/20 rounded-lg">
                <Trophy className="w-6 h-6 text-primary" />
              </div>
              <Badge variant="outline" className="border-primary/50 text-primary">
                Premium Feature
              </Badge>
            </div>
          </div>

          {/* Title and Description */}
          <div className="space-y-2">
            <h3 className="text-xl font-bold">
              {title || `Unlock ${feature}`}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {description ||
                `Upgrade to Premium to access ${feature} and unlock unlimited trading potential.`}
            </p>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-2 gap-3 py-4 my-4 border-y border-primary/20">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-primary" />
                <span className="font-semibold">Unlimited Signals</span>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Take all premium signals
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-primary" />
                <span className="font-semibold">Advanced Analytics</span>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Deep insights & charts
              </p>
            </div>
          </div>

          {/* Pricing Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-primary/20">
              <div>
                <p className="text-xs text-muted-foreground">Starting at</p>
                <p className="text-xl font-bold">₦500/month</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">First month</p>
                <p className="text-sm font-semibold text-primary">Cancel anytime</p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleUpgrade}
            size="lg"
            className="w-full gap-2 group"
          >
            {cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Button>

          {/* Footer Info */}
          <p className="text-xs text-center text-muted-foreground">
            30-day money back guarantee. No questions asked.
          </p>
        </div>
      </Card>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        tier={tier}
      />
    </>
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
