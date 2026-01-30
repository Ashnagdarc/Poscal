import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Paystack InlineJS v2 integration
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: 'premium' | 'pro';
  redirectPath?: string; // optional path to navigate after success
}

// Tier pricing configuration
const TIER_CONFIG = {
  premium: {
    name: 'Premium',
    amount: 299900, // 2999 NGN in kobo
    currency: 'NGN',
    displayPrice: '₦2,999',
    duration: '30 days',
    features: [
      'Unlimited journal entries',
      'Take unlimited signals',
      'Advanced analytics',
      'CSV export',
      'Email support',
    ],
  },
  pro: {
    name: 'Pro',
    amount: 150000, // 1500 NGN in kobo
    currency: 'NGN',
    displayPrice: '₦1,500',
    duration: '30 days',
    features: [
      'Everything in Premium',
      'MT5 broker integration',
      'API access',
      'Custom reports',
      'Priority support',
    ],
  },
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  tier,
  redirectPath = '/',
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [paystackScriptLoaded, setPaystackScriptLoaded] = useState(false);
  const [reference, setReference] = useState('');

  if (!user) return null;

  const config = TIER_CONFIG[tier];
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

  // Load Paystack script once
  React.useEffect(() => {
    if (!paystackScriptLoaded && typeof window !== 'undefined') {
      if (document.getElementById('paystack-inline-js')) {
        setPaystackScriptLoaded(true);
        return;
      }
      const script = document.createElement('script');
      script.id = 'paystack-inline-js';
      script.src = 'https://js.paystack.co/v2/inline.js';
      script.async = true;
      script.onload = () => setPaystackScriptLoaded(true);
      document.body.appendChild(script);
    }
  }, [paystackScriptLoaded]);

  React.useEffect(() => {
    if (isOpen) {
      setReference(`poscal_${user.id}_${tier}_${Date.now()}`);
      setPaymentStatus('idle');
      setErrorMessage('');
    }
  }, [isOpen, user.id, tier]);

  if (!publicKey) {
    console.error('VITE_PAYSTACK_PUBLIC_KEY is not set in environment');
    return null;
  }

  // Launch Paystack InlineJS v2
  const handlePay = () => {
    if (!(window as any).PaystackPop) {
      toast.error('Payment system not loaded. Please try again in a moment.');
      return;
    }
    setIsProcessing(true);
    setPaymentStatus('processing');
    const paystack = new (window as any).PaystackPop();
    paystack.newTransaction({
      key: publicKey,
      email: user.email,
      amount: config.amount,
      currency: config.currency,
      reference,
      onSuccess: (resp: any) => handlePaymentSuccess({ reference: resp.reference }),
      onCancel: handlePaymentClose,
    });
  };

  // Handle successful payment
  const handlePaymentSuccess = async (reference: any) => {
    try {
      setIsProcessing(true);
      setPaymentStatus('processing');

      // Verify payment with backend (Vercel serverless)
      const response = await fetch(`${apiBaseUrl}/api/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference: reference.reference,
          userId: user.id,
          tier,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Payment verification failed');
      }

      // Payment verified successfully
      setPaymentStatus('success');
      toast.success('🎉 Payment successful! Welcome to Premium!');

      // Refresh subscription context
      await refreshSubscription();

      // Close modal after showing success
      setTimeout(() => {
        onClose();
        setPaymentStatus('idle');
        // Navigate to target page after payment success
        try {
          navigate(redirectPath);
        } catch (e) {
          // noop: navigation will be skipped if router context isn't available
        }
      }, 2000);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Payment verification failed';
      setErrorMessage(errorMsg);
      setPaymentStatus('error');
      toast.error(errorMsg);
      console.error('Payment verification error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle payment close
  const handlePaymentClose = () => {
    if (paymentStatus === 'success') {
      onClose();
      setPaymentStatus('idle');
    } else {
      toast.info('Payment cancelled. Try again whenever you\'re ready.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upgrade to {config.name}</DialogTitle>
          <DialogDescription>
            Complete your payment to unlock premium features
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Success State */}
          {paymentStatus === 'success' && (
            <div className="text-center space-y-4 py-8">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <div>
                <h3 className="font-semibold text-lg mb-2">
                  Payment Successful! 🎉
                </h3>
                <p className="text-muted-foreground">
                  Your subscription is now active. Enjoy unlimited access!
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {paymentStatus === 'error' && (
            <div className="space-y-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-600 dark:text-red-400 mb-1">
                    Payment Failed
                  </h3>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errorMessage}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setPaymentStatus('idle')}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Payment Form */}
          {paymentStatus !== 'success' && paymentStatus !== 'error' && (
            <>
              {/* Tier Summary */}
              <div className="space-y-4 p-4 bg-secondary rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Plan:</span>
                    <Badge variant="outline">{config.name}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-semibold">{config.displayPrice}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-semibold">{config.duration}</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-2 flex justify-between items-center font-semibold">
                    <span>Total:</span>
                    <span className="text-lg">{config.displayPrice}</span>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">
                  You'll get access to:
                </p>
                <ul className="space-y-2">
                  {config.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Payment Button */}
              <Button
                onClick={handlePay}
                className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing || !paystackScriptLoaded}
              >
                {isProcessing ? 'Processing...' : `Pay ${config.displayPrice}`}
              </Button>

              {/* Security Notice */}
              <p className="text-xs text-center text-muted-foreground">
                🔒 Your payment is secure and processed by Paystack
              </p>

              {/* Cancelation Info */}
              <p className="text-xs text-center text-muted-foreground">
                You can cancel your subscription anytime from your settings.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
