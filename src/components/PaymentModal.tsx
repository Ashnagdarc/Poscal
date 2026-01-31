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
// ...existing code...
// ...existing code...
// The PaymentModal component is defined below (see previous patch for correct implementation)
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
