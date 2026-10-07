import { useEffect, useRef, useState } from "react";
import {
  useAction,
  useConvex,
  useMutation,
  useQuery,
  usePaginatedQuery,
} from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import { PRICES, safeReturnTo, type ProPlan } from "../../shared/proPolicy";

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount / 100);
const message = (error: unknown) => {
  if (!(error instanceof Error))
    return "We could not complete this request. Your payment reference is safe.";
  const detail = /Uncaught Error: ([^\n]+)/.exec(error.message)?.[1];
  return (
    detail ??
    (error.message.startsWith("[CONVEX")
      ? "We could not complete this request. Please check your payment status."
      : error.message.split("\n")[0])
  );
};

export function ProCheckout({
  returnTo,
  onCheckoutOpen,
}: {
  returnTo?: string;
  onCheckoutOpen?: () => void;
}) {
  const { user } = useAuth();
  const { isPaid, expiresAt, autoRenew: autoRenewState } = useSubscription();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useConvex();
  const configuration = useQuery(api.proBilling.publicConfiguration, {});
  const params = new URLSearchParams(location.search);
  const [reference, setReference] = useState(
    params.get("reference") ?? params.get("trxref") ?? undefined,
  );
  const order = useQuery(
    api.proBilling.currentOrder,
    user ? { reference } : "skip",
  );
  const history = usePaginatedQuery(
    api.proBilling.orderHistory,
    user ? {} : "skip",
    { initialNumItems: 10 },
  );
  const start = useAction(api.proPayments.startCheckout);
  const verify = useAction(api.proPayments.checkPayment);
  const setAutoRenew = useMutation(api.proBilling.setAutoRenew);
  const [plan, setPlan] = useState<ProPlan>("monthly");
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<{
    amount: number;
    code: string | null;
  } | null>(null);
  const [reminders, setReminders] = useState(false);
  const [autoRenewRequested, setAutoRenewRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const clickLock = useRef(false);
  const mounted = useRef(true);
  const destination = safeReturnTo(
    order?.returnTo ??
      returnTo ??
      params.get("returnTo") ??
      params.get("redirectPath") ??
      undefined,
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const viewerId = user?.id;
  const paymentReference = order?.reference;
  const openOrder =
    !!order && ["initializing", "pending", "review"].includes(order.status);

  useEffect(() => {
    if (!viewerId || !paymentReference || !openOrder) return;
    let active = true;
    const check = () => {
      if (active) void verify({ reference: paymentReference }).catch(() => {});
    };
    check();
    const timer = window.setInterval(check, 20_000);
    // Stop browser polling after 10 minutes. The server keeps reconciling.
    const stop = window.setTimeout(
      () => window.clearInterval(timer),
      10 * 60_000,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [viewerId, paymentReference, openOrder, verify]);

  const applyCode = async () => {
    if (!user || clickLock.current) return;
    clickLock.current = true;
    setBusy(true);
    setError("");
    try {
      setQuote(await client.query(api.proBilling.quote, { plan, code }));
    } catch (err) {
      setQuote(null);
      setError(message(err));
    } finally {
      clickLock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const launch = async (payment: typeof order) => {
    if (
      !payment?.accessCode ||
      !["pending", "initializing"].includes(payment.status)
    )
      return;
    // Close our dialog first so it does not make Paystack's iframe inert.
    onCheckoutOpen?.();
    const { default: PaystackPop } = await import("@paystack/inline-js");
    new PaystackPop().resumeTransaction(payment.accessCode, {
      onSuccess: () => {
        void verify({ reference: payment.reference }).catch(() => {});
      },
      onCancel: () => {
        void verify({ reference: payment.reference }).catch(() => {});
      },
      onError: () => {
        if (mounted.current)
          setError(
            "Secure checkout could not open. Use the secure checkout link or check this payment before retrying.",
          );
      },
    });
  };

  const checkout = async () => {
    if (!user) {
      navigate(
        `/signin?returnTo=${encodeURIComponent(`/pro?returnTo=${encodeURIComponent(destination)}`)}`,
      );
      return;
    }
    if (clickLock.current || configuration?.beta) return;
    clickLock.current = true;
    setBusy(true);
    setError("");
    try {
      if (openOrder) {
        await launch(order);
        return;
      }
      const nextReference = await start({
        plan,
        code: quote?.code ?? undefined,
        returnTo: destination,
        reminders,
        autoRenew: autoRenewRequested,
      });
      setReference(nextReference);
      // Read the durable record rather than assuming initialization/activation succeeded.
      const payment = await client.query(api.proBilling.currentOrder, {
        reference: nextReference,
      });
      if (payment?.accessCode) {
        navigate(`/pro?reference=${encodeURIComponent(nextReference)}`, {
          replace: true,
        });
        await launch(payment);
      } else
        setError(
          "We are confirming your checkout. Keep this reference and do not pay again.",
        );
    } catch (err) {
      if (mounted.current) setError(message(err));
    } finally {
      clickLock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (!configuration)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" aria-label="Loading plans" />
      </div>
    );
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-brand">
          <Sparkles size={20} />
          <span className="text-sm font-semibold">Poscal Pro</span>
        </div>
        <h1 className="text-2xl font-bold">More room for your trading.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Five journals, unlimited new trades and notebooks, full analytics and
          500 screenshots within 1 GB.
        </p>
      </div>
      {configuration.beta ? (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-5">
          <h2 className="font-semibold">Included during beta</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pro features are open. Payments are switched off until the admin
            ends beta.
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate(destination)}>
            Continue using Poscal
          </Button>
        </div>
      ) : order?.status === "paid" ? (
        <div
          className="rounded-2xl border border-green-500/30 p-5"
          role="status"
        >
          <Check className="mb-2 text-green-500" />
          <h2 className="font-semibold">Payment confirmed</h2>
          <p className="mt-2 text-sm">
            {isPaid
              ? "Your Pro access is active. Your notes and uploads are ready."
              : "This paid period has ended. Your existing data remains available."}
          </p>
          {isPaid && (
            <div className="mt-3 rounded-xl bg-secondary p-3 text-xs">
              <p className="font-medium">
                Auto-renew {autoRenewState.enabled ? "on" : "off"}
              </p>
              {autoRenewState.enabled ? (
                <p className="mt-1 text-muted-foreground">
                  {autoRenewState.brand ?? "Payment method"}
                  {autoRenewState.last4 ? ` ending ${autoRenewState.last4}` : ""}.
                  {autoRenewState.amount
                    ? ` ${money(autoRenewState.amount)} per renewal.`
                    : ""}
                  {autoRenewState.nextChargeAt
                    ? ` Next charge is scheduled for ${autoRenewState.nextChargeAt.toLocaleDateString()}.`
                    : ""}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  You will not be charged again automatically.
                </p>
              )}
              {autoRenewState.enabled && (
                <button
                  type="button"
                  className="mt-2 underline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setError("");
                    void setAutoRenew({ enabled: false })
                      .catch((err) => setError(message(err)))
                      .finally(() => setBusy(false));
                  }}
                >
                  Turn off auto-renew
                </button>
              )}
            </div>
          )}
          <Button className="mt-4 w-full" onClick={() => navigate(destination)}>
            Continue where you left off
          </Button>
          <Button
            variant="outline"
            className="mt-2 w-full"
            onClick={() => {
              setReference(undefined);
              navigate(`/pro?returnTo=${encodeURIComponent(destination)}`);
            }}
          >
            Renew Pro
          </Button>
        </div>
      ) : (
        <>
          {isPaid && (
            <div className="rounded-xl bg-secondary p-3 text-sm">
              <p>
                Pro active until {expiresAt?.toLocaleDateString()}. A renewal
                extends your existing access.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Auto-renew is {autoRenewState.enabled ? "on" : "off"}
                {autoRenewState.amount ? ` at ${money(autoRenewState.amount)} per renewal` : ""}
                {autoRenewState.last4 ? ` for the method ending ${autoRenewState.last4}` : ""}.
              </p>
              {(autoRenewState.enabled || autoRenewState.last4) && (
                <button
                  type="button"
                  className="mt-2 text-xs font-medium underline"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setError("");
                    void setAutoRenew({
                      enabled: !autoRenewState.enabled,
                      plan: autoRenewState.plan ?? plan,
                    })
                      .catch((err) => setError(message(err)))
                      .finally(() => setBusy(false));
                  }}
                >
                  {autoRenewState.enabled ? "Turn off auto-renew" : "Turn on auto-renew"}
                </button>
              )}
            </div>
          )}
          {openOrder ? (
            <div
              className="rounded-2xl border border-border bg-secondary/50 p-4"
              role="status"
            >
              <h2 className="font-semibold">
                {order.status === "review"
                  ? "Payment needs checking"
                  : "Checkout in progress"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We verify payments before activating Pro. If you have already
                been debited, do not pay again.
              </p>
              <p className="mt-2 text-sm capitalize">
                {order.plan} · {money(order.amount)}
              </p>
              <p className="mt-3 break-all font-mono text-xs">
                {order.reference}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                disabled={busy}
                onClick={() => {
                  setError("");
                  void verify({ reference: order.reference }).catch((err) =>
                    setError(message(err)),
                  );
                }}
              >
                Check payment status
              </Button>
              {order.checkoutUrl && order.status === "pending" && (
                <a className="ml-3 text-sm underline" href={order.checkoutUrl}>
                  Open secure checkout
                </a>
              )}
            </div>
          ) : (
            <>
              {order &&
                ["failed", "abandoned", "reversed"].includes(order.status) && (
                  <p
                    className="rounded-xl bg-secondary p-3 text-sm"
                    role="status"
                  >
                    Payment {order.status}. Reference: {order.reference}. If
                    your bank debited you, check this payment before starting
                    another.
                  </p>
                )}
              <div className="grid grid-cols-2 gap-3">
                {(["monthly", "yearly"] as const).map((option) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={plan === option}
                    disabled={busy}
                    onClick={() => {
                      setPlan(option);
                      setQuote(null);
                    }}
                    className={`rounded-2xl border p-4 text-left ${plan === option ? "border-brand bg-brand/10" : "border-border"}`}
                  >
                    <span className="block text-sm capitalize">{option}</span>
                    <strong className="mt-2 block text-xl">
                      {money(PRICES[option])}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {option === "yearly"
                        ? "Save ₦5,000 per year"
                        : "One calendar month"}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Discount code"
                  placeholder="Discount or early-bird code"
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  value={code}
                  maxLength={32}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setQuote(null);
                  }}
                />
                <Button
                  variant="outline"
                  disabled={busy || !user || !code.trim()}
                  onClick={() => void applyCode()}
                >
                  Apply
                </Button>
              </div>
              {quote?.code && (
                <p className="text-sm text-brand">
                  {quote.code} applied. Total: {money(quote.amount)}. Discount
                  applies to this purchase.
                </p>
              )}
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoRenewRequested}
                  onChange={(e) => setAutoRenewRequested(e.target.checked)}
                />
                <span>
                  Automatically renew this {plan} plan for {money(PRICES[plan])} per renewal
                  using this Paystack payment method. Your current discount, if any, applies only
                  to this purchase. You can turn auto-renew off before the next charge. If the
                  standard renewal price changes, Poscal will require fresh consent instead of
                  charging the new amount automatically. Auto-renew only activates if Paystack
                  returns a verified reusable authorization.
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={reminders}
                  onChange={(e) => setReminders(e.target.checked)}
                />
                Email me once if I leave this checkout unfinished.
              </label>
            </>
          )}
          <Button
            className="h-12 w-full rounded-xl"
            disabled={
              busy ||
              !configuration.ready ||
              (openOrder && !order.accessCode) ||
              order?.status === "review"
            }
            onClick={() => void checkout()}
          >
            {busy ? (
              <Loader2 className="mr-2 animate-spin" size={16} />
            ) : (
              <Lock className="mr-2" size={16} />
            )}
            {openOrder
              ? "Resume secure checkout"
              : user
                ? `Pay ${money(quote?.amount ?? PRICES[plan])}`
                : "Sign in to continue"}
          </Button>
          {!configuration.ready && (
            <p className="text-sm text-muted-foreground">
              Checkout is temporarily unavailable. Your data remains safe.
            </p>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Payment details are handled by Paystack. Auto-renew is off by default
            and only starts when you explicitly select it.
          </p>
        </>
      )}
      {user && history.results.length > 0 && (
        <section className="space-y-2 border-t pt-4">
          <h2 className="text-sm font-semibold">Payment history</h2>
          {history.results.map((payment) => (
            <button
              type="button"
              key={payment.id}
              className="flex w-full items-start justify-between gap-3 rounded-xl bg-secondary p-3 text-left text-xs"
              onClick={() => {
                setReference(payment.reference);
                navigate(
                  `/pro?reference=${encodeURIComponent(payment.reference)}`,
                  { replace: true },
                );
              }}
            >
              <span className="break-all">
                {payment.reference}
                <span className="mt-1 block text-muted-foreground">
                  {new Date(payment.createdAtMs).toLocaleDateString()} ·{" "}
                  {payment.plan}
                </span>
              </span>
              <span>
                {money(payment.amount)}
                <span className="mt-1 block capitalize">{payment.status}</span>
              </span>
            </button>
          ))}
          {history.status === "CanLoadMore" && (
            <Button variant="outline" onClick={() => history.loadMore(10)}>
              Older payments
            </Button>
          )}
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!configuration.beta && (
        <p className="text-xs text-muted-foreground">
          Free includes 1 editable journal, 15 new entries each UTC month and 5
          screenshots within 10 MB. Existing data stays readable.{" "}
          <a
            className="underline"
            href={`mailto:info@poscalfx.com?subject=${encodeURIComponent(`Poscal Pro payment ${order?.reference ?? ""}`)}`}
          >
            Payment support
          </a>
        </p>
      )}
    </div>
  );
}
