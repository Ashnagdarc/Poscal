import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Check,
  X,
  TrendingUp,
  Zap,
  BarChart3,
  FileJson,
  Lock,
  Crown,
} from 'lucide-react';
import { PaymentModal } from '@/components/PaymentModal';

// Pricing tiers configuration
const PRICING_TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'NGN',
    period: 'Forever',
    description: 'Perfect for getting started',
    cta: 'Start Free',
    features: [
      { name: '5 Journal Entries', included: true },
      { name: 'View 3 Latest Signals', included: true },
      { name: 'Basic Position Calculator', included: true },
      { name: 'Last 10 Calculations', included: true },
      { name: 'Basic Performance Stats', included: true },
      { name: '1 Trading Account', included: true },
      { name: 'Advanced Analytics', included: false },
      { name: 'Unlimited Signals', included: false },
      { name: 'CSV Export', included: false },
      { name: 'Priority Support', included: false },
    ],
    highlighted: false,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 500,
    currency: 'NGN',
    period: '/month',
    description: 'Most popular for active traders',
    cta: 'Upgrade to Premium',
    features: [
      { name: 'Unlimited Journal Entries', included: true },
      { name: 'Take Unlimited Signals', included: true },
      { name: 'Advanced Position Calculator', included: true },
      { name: 'Unlimited Calculation History', included: true },
      { name: 'Advanced Performance Analytics', included: true },
      { name: 'Multiple Trading Accounts', included: true },
      { name: 'Charts & Visualizations', included: true },
      { name: 'CSV & PDF Export', included: true },
      { name: 'Real-time Price Tracking', included: true },
      { name: 'Email Support', included: true },
    ],
    highlighted: true,
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isPaid, isTrial, subscriptionTier } = useSubscription();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const handleUpgrade = (tierId: string) => {
    // Don't redirect if auth is still loading
    if (loading) {
      return;
    }

    if (!user) {
      navigate('/signin');
      return;
    }

    if (tierId === 'free') {
      navigate('/');
      return;
    }

    setSelectedTier(tierId);
    setShowPaymentModal(true);
  };

  const getCurrentStatus = () => {
    if (isPaid) return `premium`;
    if (isTrial) return `trial`;
    return 'free';
  };

  const currentStatus = getCurrentStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your trading journey. Upgrade anytime.
          </p>
        </div>

        {/* Trial Banner (if applicable) */}
        {isTrial && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-sm text-center text-blue-600 dark:text-blue-400">
              ✨ You're currently on a free trial. All premium features are unlocked!
            </p>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-12">
          {PRICING_TIERS.map((tier) => {
            const isCurrentPlan =
              (currentStatus === tier.id) ||
              (currentStatus === 'trial' && tier.id === 'premium');
            const isFutureUpgrade = currentStatus === 'free' && tier.id === 'premium';

            return (
              <Card
                key={tier.id}
                className={`relative transition-all duration-300 flex flex-col ${
                  tier.highlighted
                    ? 'border-primary shadow-lg scale-105 md:scale-100'
                    : 'border-border'
                } ${isCurrentPlan ? 'ring-2 ring-green-500' : ''}`}
              >
                {/* Highlighted Badge */}
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      <Crown className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                {/* Current Plan Badge */}
                {isCurrentPlan && (
                  <div className="absolute -top-3 right-4">
                    <Badge className="bg-green-500 text-white">
                      ✓ Current Plan
                    </Badge>
                  </div>
                )}

                {/* Tier Content */}
                <div className="p-8">
                  <h2 className="text-2xl font-bold mb-2">{tier.name}</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    {tier.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">
                        {tier.price === 0 ? 'Free' : `₦${tier.price}`}
                      </span>
                      <span className="text-muted-foreground">
                        {tier.period}
                      </span>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleUpgrade(tier.id)}
                    disabled={isCurrentPlan}
                    className="w-full mb-8"
                    variant={
                      isCurrentPlan
                        ? 'outline'
                        : tier.highlighted
                          ? 'default'
                          : 'secondary'
                    }
                    size="lg"
                  >
                    {isCurrentPlan ? '✓ Current Plan' : tier.cta}
                  </Button>

                  {/* Features List */}
                  <div className="space-y-4">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Includes:
                    </p>
                    <ul className="space-y-3">
                      {tier.features.map((feature, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-3 text-sm"
                        >
                          {feature.included ? (
                            <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-5 h-5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                          )}
                          <span
                            className={
                              feature.included
                                ? 'text-foreground'
                                : 'text-muted-foreground line-through'
                            }
                          >
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Features Comparison Section */}
        <div className="max-w-4xl mx-auto mt-16 pt-12 border-t border-border">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Feature Comparison
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Journal Features */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Trading Journal</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Free: 5 entries max</li>
                <li>✓ Premium: Unlimited entries</li>
                <li>✓ Screenshots upload</li>
                <li>✓ Multi-account support</li>
              </ul>
            </div>

            {/* Signals Features */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Trading Signals</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Free: View 3 latest signals</li>
                <li>✓ Premium: Take unlimited signals</li>
                <li>✓ Real-time tracking</li>
                <li>✓ Auto-close on targets</li>
              </ul>
            </div>

            {/* Analytics Features */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Analytics & Tools</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Free: Basic stats</li>
                <li>✓ Premium: Advanced charts</li>
                <li>✓ Position calculator</li>
                <li>✓ CSV export</li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto mt-16 pt-12 border-t border-border">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground text-sm">
                Yes! Cancel your subscription anytime from your settings. No
                questions asked.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-muted-foreground text-sm">
                We accept all major payment methods via Paystack including cards,
                bank transfers, and USSD.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                Do I get a refund if I cancel?
              </h3>
              <p className="text-muted-foreground text-sm">
                Yes. If you cancel within 24 hours of purchase, we'll refund
                your payment in full.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Is there a free trial?</h3>
              <p className="text-muted-foreground text-sm">
                New users get a 7-day free trial with full premium access. No
                credit card required to start.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-2">
                What if I need help with my subscription?
              </h3>
              <p className="text-muted-foreground text-sm">
                Contact our support team at support@poscal.com or use the help
                button in your dashboard.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Footer */}
        <div className="max-w-2xl mx-auto mt-16 pt-12 border-t border-border text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to level up your trading?</h2>
          <p className="text-muted-foreground mb-8">
            Join thousands of traders already using Poscal Premium to track their
            trades and improve their performance.
          </p>
          {!isPaid && !isTrial && (
            <Button
              size="lg"
              onClick={() => handleUpgrade('premium')}
              className="gap-2"
            >
              <Zap className="w-4 h-4" />
              Upgrade to Premium Now
            </Button>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {selectedTier && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          tier={selectedTier as 'premium' | 'pro'}
        />
      )}
    </div>
  );
};

export default Pricing;
