import React, { useEffect, useRef, useState } from 'react';
import './PaymentModal.css';

// Declare PaystackPop on window for TypeScript
declare global {
  interface Window {
    PaystackPop?: any;
  }
}
// Paystack InlineJS v2 integration
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const TIER_CONFIG = {
  premium: {
    name: 'Premium',
    amount: 299900, // 2999 NGN in kobo
    displayPrice: '₦2,999',
    currency: 'NGN',
    duration: '1 month',
    features: [
      'Unlimited journal entries',
      'Priority support',
      'Advanced analytics',
    ],
  },
};

interface PaymentModalProps {
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
}


export const PaymentModal: React.FC<PaymentModalProps> = ({ userEmail, isOpen, onClose }) => {
  const [paystackScriptLoaded, setPaystackScriptLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const processingRef = useRef(false);
  const config = TIER_CONFIG.premium;
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const { user } = useAuth();
  // Use prop if provided, else fallback to AuthContext
  const effectiveUserEmail = userEmail || user?.email || '';

  useEffect(() => {
    if (!document.getElementById('paystack-inline-js')) {
      const script = document.createElement('script');
      script.id = 'paystack-inline-js';
      script.src = 'https://js.paystack.co/v2/inline.js';
      script.async = true;
      script.onload = () => setPaystackScriptLoaded(true);
      document.body.appendChild(script);
    } else {
      setPaystackScriptLoaded(true);
    }
  }, []);

  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setPaymentStatus('idle');
      setErrorMessage('');
      processingRef.current = false;
    }
  }, [isOpen]);

  const handlePay = () => {
        // Fallback: Reset UI if Paystack does not respond in 30 seconds
        const fallbackTimeout = setTimeout(() => {
          if (processingRef.current) {
            setIsProcessing(false);
            setPaymentStatus('error');
            setErrorMessage('Payment window did not open. Please check your popup blocker, CSP, or try again.');
            console.warn('[Paystack Warning] Payment window did not open or callback was not triggered.');
          }
        }, 30000); // 30 seconds
    // Debug: Log all payment parameters
    console.log('[Paystack Debug] handlePay called');
    console.log('[Paystack Debug] publicKey:', publicKey);
    console.log('[Paystack Debug] userEmail:', effectiveUserEmail);
    console.log('[Paystack Debug] amount:', config.amount);
    console.log('[Paystack Debug] currency:', config.currency);
    if (!publicKey) {
      setErrorMessage('Paystack public key not set');
      setPaymentStatus('error');
      console.error('[Paystack Error] Missing publicKey:', publicKey);
      return;
    }
    if (!paystackScriptLoaded) {
      setErrorMessage('Paystack script not loaded. Please refresh and try again.');
      setPaymentStatus('error');
      console.error('[Paystack Error] paystackScriptLoaded:', paystackScriptLoaded);
      return;
    }
    if (!window.PaystackPop || typeof window.PaystackPop.setup !== 'function') {
      setErrorMessage('PaystackPop.setup is not available on window.');
      setPaymentStatus('error');
      console.error('[Paystack Error] window.PaystackPop:', window.PaystackPop);
      return;
    }
    if (!effectiveUserEmail) {
      setErrorMessage('User email is missing. Please log in or contact support.');
      setPaymentStatus('error');
      console.error('[Paystack Error] effectiveUserEmail:', effectiveUserEmail);
      return;
    }
    if (config.amount <= 0) {
      setErrorMessage('Invalid payment amount. Please contact support.');
      setPaymentStatus('error');
      console.error('[Paystack Error] amount:', config.amount);
      return;
    }
    if (!config.currency) {
      setErrorMessage('Currency is missing. Please contact support.');
      setPaymentStatus('error');
      console.error('[Paystack Error] currency:', config.currency);
      return;
    }
    setIsProcessing(true);
    setPaymentStatus('processing');
    setErrorMessage('');
    try {
      if (typeof window.PaystackPop.setup === 'function') {
        const handler = window.PaystackPop.setup({
          key: publicKey,
          email: effectiveUserEmail,
          amount: config.amount,
          currency: config.currency,
          callback: (response: any) => {
            clearTimeout(fallbackTimeout);
            setIsProcessing(false);
            setPaymentStatus('success');
            processingRef.current = false;
            // You can also send response.reference to your backend for verification
          },
          onClose: () => {
            clearTimeout(fallbackTimeout);
            setIsProcessing(false);
            setPaymentStatus('idle');
            processingRef.current = false;
            toast.info('Payment cancelled. Try again whenever you\'re ready.');
          },
        });
        if (typeof handler?.openIframe === 'function') {
          handler.openIframe();
        } else if (typeof handler?.open === 'function') {
          handler.open();
        } else {
          throw new Error('Paystack handler could not be opened.');
        }
      } else {
        clearTimeout(fallbackTimeout);
        throw new Error('PaystackPop.setup is not a function.');
      }
    } catch (err: any) {
      clearTimeout(fallbackTimeout);
      setIsProcessing(false);
      setPaymentStatus('error');
      processingRef.current = false;
      setErrorMessage(err?.message || 'Paystack transaction failed.');
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && paymentStatus !== 'success') {
            toast.info('Payment cancelled. Try again whenever you\'re ready.');
          }
          if (!open) {
            onClose();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade to {config.name}</DialogTitle>
            <DialogDescription>
              Complete your payment to unlock premium features
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
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

            {paymentStatus !== 'success' && paymentStatus !== 'error' && (
              <>
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

                <Button
                  onClick={handlePay}
                  className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isProcessing || !paystackScriptLoaded}
                >
                  {isProcessing ? 'Processing...' : `Pay ${config.displayPrice}`}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  🔒 Your payment is secure and processed by Paystack
                </p>

                <p className="text-xs text-center text-muted-foreground">
                  You can cancel your subscription anytime from your settings.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
