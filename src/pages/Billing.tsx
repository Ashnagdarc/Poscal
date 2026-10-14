import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { paymentsApi, subscriptionApi } from "@/lib/api";
import { isPaymentsEnabled } from "@/lib/paymentsConfig";
import { usePaidLock } from "@/hooks/use-paid-lock";

type PaymentRow = {
  id: string;
  reference: string;
  tier: string;
  amount: number;
  currency: string;
  status: string;
  expires_at: string | null;
  paid_at: string;
};

const Billing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPaid, isTrial, subscriptionTier, expiresAt, refreshSubscription } = useSubscription();
  const { paidLockEnabled } = usePaidLock();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const paymentsEnabled = isPaymentsEnabled();

  const load = async () => {
    setLoading(true);
    try {
      const data = await paymentsApi.listMine();
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load billing history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRestore = async () => {
    if (!user?.id) return;
    setRestoring(true);
    try {
      await subscriptionApi.restorePurchase({ userId: user.id });
      await refreshSubscription();
      await load();
      toast.success("Purchase restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restore purchase");
    } finally {
      setRestoring(false);
    }
  };

  const planLabel = isTrial
    ? "Trial"
    : isPaid
      ? subscriptionTier === "pro"
        ? "Pro"
        : "Premium"
      : "Free";

  return (
    <div className="min-h-full bg-background pb-6">
      <PageHeader
        title="Billing"
        subtitle="Plan and payment history"
        icon={<CreditCard className="h-5 w-5" />}
        leading={
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/settings")}
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl space-y-6 px-6 md:max-w-3xl">
        <section className="rounded-2xl border border-border/50 bg-secondary/40 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current plan
              </p>
              <p className="mt-1 font-display text-xl font-semibold text-foreground">{planLabel}</p>
              {expiresAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Expires {format(new Date(expiresAt), "MMM d, yyyy")}
                </p>
              )}
            </div>
            <Badge variant="outline" className="rounded-full">
              {planLabel}
            </Badge>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {paymentsEnabled && paidLockEnabled && !isPaid && !isTrial && (
              <Button
                className="flex-1 rounded-xl"
                onClick={() => navigate("/upgrade?tier=premium&redirectPath=/billing")}
              >
                View plans
              </Button>
            )}
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              disabled={restoring}
              onClick={() => void handleRestore()}
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {restoring ? "Restoring…" : "Restore purchase"}
            </Button>
          </div>

          {!paymentsEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">
              Checkout is paused. You can still restore a previous purchase.
            </p>
          )}
          {paymentsEnabled && !paidLockEnabled && (
            <p className="mt-3 text-xs text-muted-foreground">
              Premium pages are open for everyone until an admin turns on the paid features lock.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Payment history
          </h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-border/50 bg-secondary/30 p-5">
                  <Skeleton className="mb-2 h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 px-6 py-10 text-center">
              <CreditCard className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-semibold text-foreground">No payments yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Successful Paystack charges will show up here.
              </p>
            </div>
          ) : (
            rows.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-border/50 bg-secondary/40 px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold capitalize text-foreground">{row.tier}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{row.reference}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(row.paid_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {(row.amount / 100).toLocaleString(undefined, {
                        style: "currency",
                        currency: row.currency || "NGN",
                      })}
                    </p>
                    <Badge variant="secondary" className="mt-1 rounded-full text-[10px] uppercase">
                      {row.status}
                    </Badge>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </main>
    </div>
  );
};

export default Billing;
