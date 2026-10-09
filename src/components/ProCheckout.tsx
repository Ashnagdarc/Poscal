import { useEffect, useRef, useState } from "react";
import {
  useAction,
  useConvex,
  useMutation,
  useQuery,
  usePaginatedQuery,
} from "convex/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Loader2,
  LockKeyhole,
  Tag,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { Button } from "@/components/ui/button";
import {
  ChartLineIcon,
  type ChartLineIconHandle,
} from "@/components/ui/chart-line";
import {
  FileStackIcon,
  type FileStackIconHandle,
} from "@/components/ui/file-stack";
import {
  SwitchCameraIcon,
  type SwitchCameraIconHandle,
} from "@/components/ui/switch-camera";
import { cn } from "@/lib/utils";
import { PRICES, safeReturnTo, type ProPlan } from "../../shared/proPolicy";

const money = (amount: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount / 100);

const membershipDate = (date: Date) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

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

function ToggleRow({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 first:border-b first:border-border/60 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-foreground">
          {label}
        </span>
        <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-foreground/15 transition-colors duration-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 peer-checked:bg-brand peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
      />
    </label>
  );
}

export function ProCheckout({
  returnTo,
  onCheckoutOpen,
  presentation = "page",
}: {
  returnTo?: string;
  onCheckoutOpen?: () => void;
  presentation?: "page" | "sheet";
}) {
  const { user } = useAuth();
  const {
    isPaid,
    isLoading: subscriptionLoading,
    expiresAt,
    autoRenew: autoRenewState,
  } = useSubscription();
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
  const [plan, setPlan] = useState<ProPlan>("yearly");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [quote, setQuote] = useState<{
    amount: number;
    code: string | null;
  } | null>(null);
  const [reminders, setReminders] = useState(false);
  const [autoRenewRequested, setAutoRenewRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [error, setError] = useState("");
  const clickLock = useRef(false);
  const mounted = useRef(true);
  const journalIconRef = useRef<FileStackIconHandle>(null);
  const tradesIconRef = useRef<ChartLineIconHandle>(null);
  const screenshotsIconRef = useRef<SwitchCameraIconHandle>(null);
  const destination = safeReturnTo(
    order?.returnTo ??
      returnTo ??
      params.get("returnTo") ??
      params.get("redirectPath") ??
      undefined,
  );
  const firstName = user?.full_name?.trim().split(/\s+/)[0]?.slice(0, 32);
  const greeting = firstName ? `Hey boss, ${firstName}.` : "Hey boss.";
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
    if (isPaid && reference && order?.status === "paid") setShowPlans(false);
  }, [isPaid, reference, order?.status]);

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

  if (!configuration || subscriptionLoading)
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin" aria-label="Loading plans" />
      </div>
    );
  const sheet = presentation === "sheet";
  const activeMemberView = isPaid && !showPlans;
  const buying =
    !configuration.beta &&
    !activeMemberView &&
    (order?.status !== "paid" || showPlans);
  return (
    <div
      className={cn(
        "pro-checkout",
        sheet ? "px-5 pb-6 pt-10" : "animate-fade-in",
      )}
    >
      {(buying || activeMemberView) && !sheet && (
        <nav
          className="flex items-center justify-between"
          aria-label="Checkout navigation"
        >
          <button
            type="button"
            className="-ml-2 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            onClick={() => {
              if (isPaid && showPlans) setShowPlans(false);
              else navigate(destination);
            }}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/20">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            </span>
            Back
          </button>
          {buying && !isPaid && (
            <button
              type="button"
              className="-mr-2 min-h-11 rounded-full px-2 text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
              onClick={() => navigate(destination)}
            >
              Skip
            </button>
          )}
        </nav>
      )}
      {isPaid && showPlans && sheet && (
        <button
          type="button"
          className="-ml-2 mb-4 flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onClick={() => setShowPlans(false)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to membership
        </button>
      )}
      {buying && (
        <header
          className={cn(
            "mb-7 text-left",
            sheet ? "mt-2" : "mt-[clamp(3rem,10vh,5.5rem)]",
          )}
        >
          <p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">
            {isPaid
              ? openOrder
                ? "Your Pro renewal"
                : "Extend your Pro access"
              : "Subscribe to Poscal Pro"}
          </p>
          {isPaid ? (
            <h1 className="mt-2 text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.052em] text-foreground sm:text-[2.65rem]">
              Keep your Pro access.
            </h1>
          ) : (
            <h1 className="mt-2 text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.052em] text-foreground sm:text-[2.65rem]">
            Unlock{" "}
            <span
              className="inline-flex items-baseline gap-1 whitespace-nowrap"
              onMouseEnter={() => journalIconRef.current?.startAnimation()}
              onMouseLeave={() => journalIconRef.current?.stopAnimation()}
            >
              <FileStackIcon
                ref={journalIconRef}
                className="inline-flex translate-y-[0.08em] align-middle"
                size={31}
                aria-hidden
              />
              five journals
            </span>
            ,{" "}
            <span
              className="inline-flex items-baseline gap-1 whitespace-nowrap"
              onMouseEnter={() => tradesIconRef.current?.startAnimation()}
              onMouseLeave={() => tradesIconRef.current?.stopAnimation()}
            >
              <ChartLineIcon
                ref={tradesIconRef}
                className="inline-flex translate-y-[0.08em] align-middle"
                size={31}
                aria-hidden
              />
              unlimited trades
            </span>
            ,{" "}
            <span
              className="inline-flex items-baseline gap-1 whitespace-nowrap"
              onMouseEnter={() => screenshotsIconRef.current?.startAnimation()}
              onMouseLeave={() => screenshotsIconRef.current?.stopAnimation()}
            >
              <SwitchCameraIcon
                ref={screenshotsIconRef}
                className="inline-flex translate-y-[0.08em] align-middle"
                size={31}
                aria-hidden
              />
              500 screenshots
            </span>{" "}
            and more.
            </h1>
          )}
        </header>
      )}
      {activeMemberView && (
        <header
          className={cn(
            "mb-8 text-left",
            sheet ? "mt-2" : "mt-[clamp(3rem,10vh,5.5rem)]",
          )}
        >
          <p className="text-[17px] font-semibold tracking-[-0.015em] text-foreground">
            Poscal Pro
          </p>
          <h1
            id="pro-member-heading"
            className="mt-2 break-words text-[2.35rem] font-semibold leading-[1.08] tracking-[-0.052em] text-foreground sm:text-[2.65rem]"
          >
            {greeting}
            <br />
            You&apos;re already in.
          </h1>
          <p className="mt-7 text-[13px] leading-relaxed text-muted-foreground">
            Your Pro access is active. No need to buy it twice (we checked).
          </p>
        </header>
      )}
      <div className="space-y-4">
        {activeMemberView ? (
          <section aria-labelledby="membership-heading">
            {reference && order?.status === "paid" && (
              <p className="mb-4 text-sm font-medium text-brand" role="status">
                Payment confirmed. Your Pro access is active.
              </p>
            )}
            {openOrder && (
              <div className="mb-6 rounded-[1.15rem] bg-secondary/70 p-4" role="status">
                <p className="text-sm font-semibold text-foreground">
                  {order.status === "review"
                    ? "Your payment needs checking"
                    : "Your extension is in progress"}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Your current access is safe. If you were debited, check this payment before trying again.
                </p>
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-foreground underline underline-offset-4"
                  onClick={() => setShowPlans(true)}
                >
                  Review payment
                </button>
              </div>
            )}

            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <h2 id="membership-heading" className="text-[15px] font-semibold text-foreground">
                Your membership
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />
                Active
              </span>
            </div>
            <dl className="divide-y divide-border/60 text-sm">
              <div className="flex items-center justify-between gap-3 py-4">
                <dt className="text-muted-foreground">Access until</dt>
                <dd className="text-right font-medium text-foreground">
                  {expiresAt ? membershipDate(expiresAt) : "Active now"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-4">
                <dt className="text-muted-foreground">Auto-renew</dt>
                <dd className="text-right font-medium text-foreground">
                  {autoRenewState.enabled ? "On" : "Off"}
                </dd>
              </div>
            </dl>
            {autoRenewState.enabled ? (
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {autoRenewState.brand ?? "Payment method"}
                {autoRenewState.last4 ? ` ending ${autoRenewState.last4}` : ""}
                {autoRenewState.amount ? ` · ${money(autoRenewState.amount)} per renewal` : ""}
                {autoRenewState.nextChargeAt
                  ? ` · Next charge ${membershipDate(autoRenewState.nextChargeAt)}`
                  : ""}
              </p>
            ) : (
              <p className="mt-1 text-[13px] text-muted-foreground">
                No automatic charges. Your access remains active until the date above.
              </p>
            )}
            {(autoRenewState.enabled || (!configuration.beta && autoRenewState.last4)) && (
              <button
                type="button"
                className="mt-3 text-[13px] font-medium text-foreground underline underline-offset-4 disabled:opacity-50"
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
                Turn {autoRenewState.enabled ? "off" : "on"} auto-renew
              </button>
            )}

            <Button
              className="group mt-8 h-16 w-full rounded-[1.25rem] bg-foreground text-[17px] font-semibold text-background shadow-[0_16px_38px_-26px_hsl(var(--foreground)/0.9)] transition-transform duration-200 hover:scale-[0.995] hover:bg-foreground/90 active:scale-[0.985]"
              onClick={() => {
                onCheckoutOpen?.();
                navigate(destination);
              }}
            >
              Continue using Poscal
              <span className="ml-2 flex h-7 w-7 items-center justify-center rounded-full border border-background/15 bg-background/10 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </span>
            </Button>
            {!configuration.beta && !openOrder && (
              <button
                type="button"
                className="mt-2 flex min-h-11 w-full items-center justify-center rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                onClick={() => setShowPlans(true)}
              >
                Extend access
              </button>
            )}
          </section>
        ) : configuration.beta ? (
          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-5">
            <h2 className="font-semibold">Included during beta</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pro features are open. Payments are switched off until the admin
              ends beta.
            </p>
            <Button
              className="mt-4 w-full"
              onClick={() => navigate(destination)}
            >
              Continue using Poscal
            </Button>
          </div>
        ) : order?.status === "paid" && !showPlans ? (
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
                    {autoRenewState.last4
                      ? ` ending ${autoRenewState.last4}`
                      : ""}
                    .
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
            <Button
              className="mt-4 w-full"
              onClick={() => navigate(destination)}
            >
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
              <p className="px-1 text-[13px] leading-relaxed text-muted-foreground">
                Your Pro access is active until {expiresAt ? membershipDate(expiresAt) : "your current period ends"}. This purchase extends that access.
              </p>
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
                  <a
                    className="ml-3 text-sm underline"
                    href={order.checkoutUrl}
                  >
                    Open secure checkout
                  </a>
                )}
              </div>
            ) : (
              <>
                {order &&
                  ["failed", "abandoned", "reversed"].includes(
                    order.status,
                  ) && (
                    <p
                      className="rounded-xl bg-secondary p-3 text-sm"
                      role="status"
                    >
                      Payment {order.status}. Reference: {order.reference}. If
                      your bank debited you, check this payment before starting
                      another.
                    </p>
                  )}
                <section aria-labelledby="billing-plan-heading">
                  <div className="mb-3 flex items-end justify-between px-1">
                    <h2
                      id="billing-plan-heading"
                      className="text-[15px] font-semibold text-foreground"
                    >
                      Choose a plan
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Two simple options
                    </p>
                  </div>
                  <div
                    className="space-y-2"
                    role="radiogroup"
                    aria-label="Billing plan"
                  >
                    {(["yearly", "monthly"] as const).map((option) => {
                      const selected = option === plan;
                      const yearly = option === "yearly";
                      return (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          key={option}
                          disabled={busy}
                          onClick={() => {
                            setPlan(option);
                            setQuote(null);
                          }}
                          className={cn(
                            "relative flex min-h-[6.25rem] w-full items-center gap-3 rounded-[1.4rem] border px-4 py-4 text-left transition-[background-color,border-color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60",
                            selected
                              ? "border-brand/60 bg-brand/[0.08]"
                              : "border-transparent bg-secondary/70 hover:bg-secondary",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                              selected
                                ? "border-brand bg-brand text-brand-foreground"
                                : "border-muted-foreground/40 bg-background/40",
                            )}
                            aria-hidden
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-[17px] font-semibold tracking-[-0.015em]">
                                {yearly ? "Annual" : "Monthly"}
                              </span>
                              {yearly && (
                                <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-brand-foreground">
                                  Best value
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                              {yearly
                                ? `${money(Math.round(PRICES.yearly / 12))}/month equivalent · Save ₦5,000`
                                : "Pay month to month · No annual commitment"}
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block text-[1.35rem] font-semibold leading-none tracking-[-0.03em]">
                              {money(PRICES[option])}
                            </span>
                            <span className="mt-1.5 block text-xs text-muted-foreground">
                              per {yearly ? "year" : "month"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
                {showCode ? (
                  <div className="flex gap-2 rounded-xl border border-border/70 p-2">
                    <input
                      aria-label="Discount code"
                      placeholder="Promotion code"
                      disabled={busy}
                      className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground/70"
                      value={code}
                      maxLength={32}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setQuote(null);
                      }}
                    />
                    <Button
                      variant="outline"
                      className="rounded-lg"
                      disabled={busy || !user || !code.trim()}
                      onClick={() => void applyCode()}
                    >
                      Apply
                    </Button>
                  </div>
                ) : null}
                {quote?.code && (
                  <p className="text-center text-sm font-medium text-brand">
                    {quote.code} applied · {money(quote.amount)}
                  </p>
                )}
              </>
            )}
            <Button
              className="group h-16 w-full rounded-[1.25rem] bg-foreground text-[17px] font-semibold text-background shadow-[0_16px_38px_-26px_hsl(var(--foreground)/0.9)] transition-transform duration-200 hover:scale-[0.995] hover:bg-foreground/90 active:scale-[0.985]"
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
              ) : null}
              {openOrder
                ? "Resume secure checkout"
                : user
                  ? `Continue with ${plan === "yearly" ? "Annual" : "Monthly"} · ${money(quote?.amount ?? PRICES[plan])}`
                  : "Sign in to continue"}
              {!busy && !openOrder && (
                <span className="ml-2 flex h-7 w-7 items-center justify-center rounded-full border border-background/15 bg-background/10 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </span>
              )}
            </Button>
            {!configuration.ready && (
              <p className="text-sm text-muted-foreground">
                Checkout is temporarily unavailable. Your data remains safe.
              </p>
            )}
            {!openOrder && (
              <div className="flex min-h-11 items-center justify-center text-sm font-medium text-muted-foreground">
                <button
                  type="button"
                  className="flex min-h-11 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-secondary/60 hover:text-foreground"
                  onClick={() => setShowCode((current) => !current)}
                >
                  <Tag className="h-3.5 w-3.5" aria-hidden />
                  {showCode ? "Hide promo code" : "Add promo code"}
                </button>
              </div>
            )}
            {!openOrder && (
              <details className="group text-center text-sm text-muted-foreground">
                <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-full px-3 font-medium transition-colors marker:hidden hover:bg-secondary/60 hover:text-foreground">
                  Renewal &amp; reminders
                  <ChevronDown
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="mt-3 overflow-hidden rounded-[1.15rem] border border-border/70 bg-card/40 text-left">
                  <ToggleRow
                    checked={autoRenewRequested}
                    disabled={busy}
                    label="Automatic renewal"
                    description={`Renew at ${money(PRICES[plan])}. Off by default.`}
                    onChange={setAutoRenewRequested}
                  />
                  <ToggleRow
                    checked={reminders}
                    disabled={busy}
                    label="Checkout reminder"
                    description="Email me if I leave this unfinished."
                    onChange={setReminders}
                  />
                </div>
              </details>
            )}
            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted-foreground/90">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
              Paystack-secured checkout · Cancel renewal anytime
            </p>
          </>
        )}
        {user && history.results.length > 0 && (
          <details className="group text-center">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors marker:hidden hover:text-foreground">
              Payment history
              <ChevronDown
                className="h-3 w-3 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <section className="mt-3 space-y-2 rounded-2xl border border-border/60 bg-card/35 p-2 text-left">
              {history.results.map((payment) => (
                <button
                  type="button"
                  key={payment.id}
                  className="flex w-full items-start justify-between gap-3 rounded-xl bg-secondary/70 p-3 text-left text-xs transition-colors hover:bg-secondary"
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
                    <span className="mt-1 block capitalize">
                      {payment.status}
                    </span>
                  </span>
                </button>
              ))}
              {history.status === "CanLoadMore" && (
                <Button variant="outline" onClick={() => history.loadMore(10)}>
                  Older payments
                </Button>
              )}
            </section>
          </details>
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
          <p className="text-center text-[13px] text-muted-foreground">
            <a
              className="underline"
              href={`mailto:info@poscalfx.com?subject=${encodeURIComponent(`Poscal Pro payment ${order?.reference ?? ""}`)}`}
            >
              Payment support
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
