// Utility to add/remove a class from body
function setBodyClass(className: string, add: boolean) {
  if (typeof document !== 'undefined') {
    if (add) document.body.classList.add(className);
    else document.body.classList.remove(className);
  }
}
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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

}

// Tier pricing configuration
const TIER_CONFIG = {
  premium: {
    name: 'Premium',
    amount: 299900, // 2999 NGN in kobo
  userEmail: string;
      'Unlimited journal entries',
      'Take unlimited signals',
      'CSV export',
      'Email support',
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
export const PaymentModal: React.FC<PaymentModalProps> = ({ userEmail }) => {
  const [paystackLoaded, setPaystackLoaded] = useState(false);
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

  React.useEffect(() => {
    if (!document.getElementById('paystack-inline-js')) {
      const script = document.createElement('script');
      script.id = 'paystack-inline-js';
      script.src = 'https://js.paystack.co/v2/inline.js';
      script.async = true;
      script.onload = () => setPaystackLoaded(true);
      document.body.appendChild(script);
    } else {
      setPaystackLoaded(true);
    }
  }, []);

  if (!publicKey) {
    return <div>Paystack public key not set</div>;
  }
  }, [paystackScriptLoaded]);
  const handlePay = () => {
    if (!(window as any).PaystackPop) return;
    const paystack = new (window as any).PaystackPop();
    paystack.newTransaction({
      key: publicKey,
      email: userEmail,
      amount: AMOUNT,
      currency: CURRENCY,
      reference: `poscal_${Date.now()}`,
      onSuccess: (resp: any) => alert('Payment successful!'),
      onCancel: () => alert('Payment cancelled'),
    });
  };
      setErrorMessage('');
  return (
    <button
      onClick={handlePay}
      disabled={!paystackLoaded}
      style={{ padding: '1rem', fontSize: '1.2rem', width: '100%', background: '#222', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
    >
      Pay {DISPLAY_PRICE}
    </button>
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
    <>
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
      {showPaystackPortal && createPortal(
        <div id="paystack-portal" style={{ position: 'fixed', zIndex: 2147483647, top: 0, left: 0 }} />,
        document.body
      )}
    </>
  );
};
