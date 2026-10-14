import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CreditCard, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdmin } from "@/hooks/use-admin";
import { paymentsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

type PaymentRow = {
  id: string;
  user_id: string;
  reference: string;
  tier: string;
  amount: number;
  currency: string;
  status: string;
  expires_at: string | null;
  paid_at: string;
  created_at: string;
};

const AdminPayments = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userFilter, setUserFilter] = useState("");

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/settings");
  }, [isAdmin, adminLoading, navigate]);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await paymentsApi.listAll({
        userId: userFilter.trim() || null,
        limit: 100,
      });
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load payments");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    // Initial admin load only; filter button reloads explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (adminLoading || !isAdmin) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background pb-6">
      <PageHeader
        title="Payment records"
        subtitle="Paystack sync history"
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
        actions={
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => void load(true)}
            disabled={refreshing}
            aria-label="Refresh payments"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        }
      />

      <main className="mx-auto max-w-2xl space-y-4 px-6 md:max-w-3xl">
        <div className="flex gap-2">
          <Input
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="Filter by user id…"
            className="h-11 rounded-xl"
          />
          <Button className="rounded-xl" onClick={() => void load()}>
            Filter
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-secondary/30 p-5">
                <Skeleton className="mb-2 h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 px-6 py-12 text-center">
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground">No payment records</h3>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-border/50 bg-secondary/40 px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold capitalize text-foreground">{row.tier}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{row.reference}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">User {row.user_id}</p>
                    <p className="mt-1 text-xs text-muted-foreground/80">
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
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPayments;
