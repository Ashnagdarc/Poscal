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
// ...existing code...

// Tier pricing configuration
const TIER_CONFIG = {
  premium: {
    name: 'Premium',
    amount: 299900, // 2999 NGN in kobo
  userEmail: string;
      'Unlimited journal entries',
      const AMOUNT = 299900; // 2999 NGN in kobo
      const DISPLAY_PRICE = '₦2,999';
      const CURRENCY = 'NGN';
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
        userEmail: string;
  React.useEffect(() => {
    if (!document.getElementById('paystack-inline-js')) {
      export const PaymentModal: React.FC<PaymentModalProps> = ({ userEmail }) => {
        const [paystackLoaded, setPaystackLoaded] = useState(false);
        const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      reference: `poscal_${Date.now()}`,
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
// Tier pricing configuration
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
