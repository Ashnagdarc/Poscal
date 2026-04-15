import React, { useEffect, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

// Declare PaystackPop on window for TypeScript
declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: Record<string, unknown>) => { openIframe?: () => void; open?: () => void };
    };
  }
}
// Paystack InlineJS v2 integration
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Check, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { subscriptionApi } from '@/lib/api';

const PAYSTACK_FALLBACK_TIMEOUT_MS = 30_000;

const CHECKLIST_ITEMS = [
  'Full access to trading journal',
  'Full access to trading signals',
  'Advanced Position Calculator',
];

const PLAN_OPTIONS = [
  {
    id: 'monthly',
    name: 'Monthly',
    amount: 300000, // 3,000 NGN in kobo
    displayPrice: '₦3,000',
    periodLabel: '/mo',
    summary: 'Cancel anytime',
  },
  {
    id: 'yearly',
    name: 'Yearly',
    amount: 3000000, // 30,000 NGN in kobo
    displayPrice: '₦30,000',
    periodLabel: '/yr',
    summary: 'Best value for active traders',
    badge: 'Save 17%',
  },
  {
    id: 'lifetime',
    name: 'Lifetime',
    amount: 10000000, // 100,000 NGN in kobo
    displayPrice: '₦100,000',
    periodLabel: 'once',
    summary: 'One payment, lifetime access',
  },
] as const;

type PlanId = (typeof PLAN_OPTIONS)[number]['id'];

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  tier?: 'premium' | 'pro';
  redirectPath?: string;
}


export const PaymentModal: React.FC<PaymentModalProps> = ({
  userEmail,
  isOpen,
  onClose,
  tier = 'premium',
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>('yearly');
  const [paystackScriptLoaded, setPaystackScriptLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const processingRef = useRef(false);
  const suppressCloseToastRef = useRef(false);
  const selectedPlan = PLAN_OPTIONS.find((plan) => plan.id === selectedPlanId) || PLAN_OPTIONS[1];
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
  const { user } = useAuth();
  const { refreshSubscription } = useSubscription();
  // Use prop if provided, else fallback to AuthContext
  const effectiveUserEmail = userEmail || user?.email || '';
  const userId = user?.id || '';

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
    if (!isOpen) {
      setIsProcessing(false);
      setPaymentStatus('idle');
      setErrorMessage('');
      processingRef.current = false;
      setSelectedPlanId('yearly');
    }
  }, [isOpen]);

  const computeExpiryIso = (planId: PlanId): string => {
    const date = new Date();
    if (planId === 'monthly') {
      date.setMonth(date.getMonth() + 1);
      return date.toISOString();
    }
    if (planId === 'yearly') {
      date.setFullYear(date.getFullYear() + 1);
      return date.toISOString();
    }
    date.setFullYear(date.getFullYear() + 100);
    return date.toISOString();
  };

  const handlePay = () => {
    if (!publicKey) {
      setErrorMessage('Paystack public key not set');
      setPaymentStatus('error');
      toast.error('Paystack public key not set. Please contact support.');
      return;
    }
    if (!paystackScriptLoaded) {
      setErrorMessage('Paystack script not loaded. Please refresh and try again.');
      setPaymentStatus('error');
      toast.error('Paystack script not loaded. Please refresh and try again.');
      return;
    }
    if (!window.PaystackPop || typeof window.PaystackPop.setup !== 'function') {
      setErrorMessage('PaystackPop.setup is not available on window.');
      setPaymentStatus('error');
      toast.error('Paystack is unavailable right now. Please refresh and try again.');
      return;
    }
    if (!effectiveUserEmail) {
      setErrorMessage('User email is missing. Please log in or contact support.');
      setPaymentStatus('error');
      toast.error('User email is missing. Please sign in again.');
      return;
    }
    if (selectedPlan.amount <= 0) {
      setErrorMessage('Invalid payment amount. Please contact support.');
      setPaymentStatus('error');
      toast.error('Invalid payment amount. Please contact support.');
      return;
    }

    // Close the Radix dialog before opening Paystack to avoid focus/inert lock.
    suppressCloseToastRef.current = true;
    onClose();

    // Fallback: Reset UI if Paystack does not respond in 30 seconds.
    const fallbackTimeout = setTimeout(() => {
      if (processingRef.current) {
        processingRef.current = false;
        setIsProcessing(false);
        setPaymentStatus('error');
        setErrorMessage('Payment window did not open. Please check your popup blocker, CSP, or try again.');
        toast.error('Payment window did not open. Please try again.');
        logger.warn('[Paystack] Payment window did not open or callback was not triggered.');
      }
    }, PAYSTACK_FALLBACK_TIMEOUT_MS);

    processingRef.current = true;
    setIsProcessing(true);
    setPaymentStatus('processing');
    setErrorMessage('');
    try {
      if (typeof window.PaystackPop.setup === 'function') {
        const handler = window.PaystackPop.setup({
          key: publicKey,
          email: effectiveUserEmail,
          amount: selectedPlan.amount,
          currency: 'NGN',
          metadata: {
            custom_fields: [
              {
                display_name: 'Plan',
                variable_name: 'plan_id',
                value: selectedPlan.id,
              },
            ],
          },
          callback: async (response: { reference?: string }) => {
            clearTimeout(fallbackTimeout);
            processingRef.current = false;
            setIsProcessing(false);
            setPaymentStatus('success');
            suppressCloseToastRef.current = false;
            try {
              if (!response?.reference) {
                throw new Error('Missing payment reference from Paystack.');
              }
              if (!userId) {
                throw new Error('Missing user id. Please sign in again.');
              }
              await subscriptionApi.verifyPayment({
                reference: response.reference,
                userId,
                tier,
                amount: selectedPlan.amount,
                currency: 'NGN',
                expiresAt: computeExpiryIso(selectedPlan.id),
                metadata: {
                  planId: selectedPlan.id,
                  planName: selectedPlan.name,
                },
              });
              await refreshSubscription();
              toast.success('Subscription activated. Welcome aboard.');
            } catch (verifyError: unknown) {
              setPaymentStatus('error');
              const msg = verifyError instanceof Error ? verifyError.message : 'Payment verified but subscription was not activated.';
              setErrorMessage(msg);
              toast.error('Payment verified, but subscription activation failed. Please contact support.');
            }
          },
          onClose: () => {
            clearTimeout(fallbackTimeout);
            processingRef.current = false;
            setIsProcessing(false);
            setPaymentStatus('idle');
            suppressCloseToastRef.current = false;
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
    } catch (err: unknown) {
      clearTimeout(fallbackTimeout);
      processingRef.current = false;
      setIsProcessing(false);
      setPaymentStatus('error');
      suppressCloseToastRef.current = false;
      setErrorMessage(err instanceof Error ? err.message : 'Paystack transaction failed.');
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && paymentStatus !== 'success' && !suppressCloseToastRef.current) {
            toast.info('Payment cancelled. Try again whenever you\'re ready.');
          }
          if (!open) {
            suppressCloseToastRef.current = false;
          }
          if (!open) {
            onClose();
          }
        }}
      >
        <DialogContent className="overflow-hidden border-0 p-0 sm:max-w-[470px]">

          <div className="max-h-[90vh] overflow-y-auto bg-neutral-50">
            {paymentStatus === 'success' && (
              <div className="space-y-4 px-6 py-10 text-center">
                <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
                <div>
                  <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                    Payment successful
                  </h3>
                  <p className="text-sm text-neutral-600">
                    Your access has been activated. You now have full premium access.
                  </p>
                </div>
              </div>
            )}

            {paymentStatus === 'error' && (
              <div className="m-6 space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
                  <div>
                    <h3 className="mb-1 font-semibold text-red-700">
                      Payment Failed
                    </h3>
                    <p className="text-sm text-red-700">
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
              <div>
                <div className="relative h-64 overflow-hidden bg-black">
                  <div className="absolute inset-0 bg-gradient-to-b from-black via-neutral-950 to-black" />
                  <div className="absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full border border-neutral-600 bg-[radial-gradient(circle_at_35%_30%,#3f3f46,#111827_55%,#09090b)] shadow-[0_18px_40px_rgba(0,0,0,0.75)]" />
                  <div className="absolute left-[-28px] top-20 h-36 w-36 rounded-full border border-neutral-800 bg-[radial-gradient(circle_at_40%_30%,#18181b,#030712_70%)] opacity-70" />
                  <div className="absolute right-[-28px] top-20 h-36 w-36 rounded-full border border-neutral-800 bg-[radial-gradient(circle_at_40%_30%,#18181b,#030712_70%)] opacity-70" />
                  <div className="absolute inset-x-0 bottom-4 text-center text-xs text-neutral-400">
                    Premium access starts now
                  </div>
                </div>

                <div className="-mt-4 rounded-t-[28px] bg-neutral-100 px-5 pb-5 pt-8">
                  <div className="space-y-2 text-center">
                    <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">
                      Begin your journey
                    </h2>
                    <p className="text-sm leading-relaxed text-neutral-600">
                      Unlock peace of mind and access everything you need to trade with confidence.
                    </p>
                  </div>

                  <ul className="mt-5 space-y-2.5">
                    {CHECKLIST_ITEMS.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-[15px] text-neutral-800">
                        <Check className="h-4 w-4 text-neutral-900" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {PLAN_OPTIONS.map((plan) => {
                      const selected = plan.id === selectedPlan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`relative rounded-md border px-2 py-2 text-left transition ${
                            selected
                              ? 'border-blue-400 bg-blue-50 shadow-[0_0_0_1px_rgba(59,130,246,0.45)]'
                              : 'border-neutral-300 bg-white hover:border-neutral-400'
                          }`}
                        >
                          <div className="text-sm font-semibold text-neutral-900">{plan.name}</div>
                          <div className="mt-1 text-[22px] font-semibold leading-none text-neutral-900">
                            {plan.displayPrice}
                          </div>
                          <div className="mt-1 text-xs text-neutral-600">{plan.periodLabel}</div>
                          <div className="mt-1 min-h-[16px] text-[11px] text-neutral-600">{plan.summary}</div>
                          {plan.badge && (
                            <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-300 text-[10px] font-semibold text-amber-950 hover:bg-amber-300">
                              {plan.badge}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    onClick={handlePay}
                    className="mt-8 h-12 w-full rounded-md bg-black text-base font-semibold text-white hover:bg-neutral-900 disabled:opacity-60"
                    disabled={isProcessing || !paystackScriptLoaded}
                  >
                    {isProcessing ? 'Processing...' : `Continue - ${selectedPlan.displayPrice}`}
                  </Button>

                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-neutral-600">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Secure checkout powered by Paystack</span>
                  </div>

                  <div className="mt-5 flex items-center justify-center gap-3 text-xs text-neutral-600">
                    <button type="button" className="hover:text-neutral-800">Restore</button>
                    <span>•</span>
                    <button type="button" className="hover:text-neutral-800">Terms</button>
                    <span>•</span>
                    <button type="button" className="hover:text-neutral-800">Privacy policy</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
