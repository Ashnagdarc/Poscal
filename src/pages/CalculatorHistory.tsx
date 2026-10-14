import { useNavigate } from "react-router-dom";
import { ArrowLeft, History, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaginatedCalculatorHistory } from "@/hooks/queries/use-calculator-history-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  clearJournalEntries,
  deleteCalculatorHistoryItem,
} from "@/lib/calculatorHistory";
import type { SavedCalculationRecord } from "@/lib/calculatorHistory";

function buildCalculatorPrefill(item: SavedCalculationRecord) {
  const params = new URLSearchParams();
  params.set("symbol", item.symbol);
  if (item.orderType) params.set("orderType", item.orderType);
  if (item.accountBalance) params.set("balance", String(item.accountBalance));
  if (item.riskPercent) params.set("risk", String(item.riskPercent));
  if (item.entryPrice != null) params.set("entry", String(item.entryPrice));
  if (item.stopLossPrice != null) {
    params.set("stopLoss", String(item.stopLossPrice));
  } else if (item.stopLossPips != null) {
    params.set("stopLossPips", String(item.stopLossPips));
  }
  if (item.takeProfitPrice != null) {
    params.set("takeProfit", String(item.takeProfitPrice));
  } else if (item.takeProfitPips != null) {
    params.set("takeProfitPips", String(item.takeProfitPips));
  }
  return `/?${params.toString()}`;
}

const CalculatorHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, canLoadMore, isLoadingMore, loadMore } = usePaginatedCalculatorHistory();

  const handleClear = async () => {
    await clearJournalEntries(user?.id);
    toast.success("Saved calculations cleared");
    window.location.reload();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCalculatorHistoryItem(id, user?.id);
      toast.success("Calculation removed");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove calculation");
    }
  };

  return (
    <div className="min-h-full bg-background pb-6">
      <PageHeader
        title="Calculator history"
        subtitle="Reopen saved position sizes"
        icon={<History className="h-5 w-5" />}
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
          data.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-destructive"
              onClick={() => void handleClear()}
            >
              Clear all
            </Button>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-2xl space-y-4 px-6 md:max-w-3xl">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/50 bg-secondary/30 p-5">
                <Skeleton className="mb-3 h-5 w-32" />
                <Skeleton className="mb-2 h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/30 px-6 py-12 text-center">
            <History className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold text-foreground">No saved calculations</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Save a position size from the calculator to see it here.
            </p>
            <Button className="mt-5 rounded-xl" onClick={() => navigate("/")}>
              Open calculator
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <article
                key={item.id}
                className="overflow-hidden rounded-2xl border border-border/50 bg-secondary/40"
              >
                <button
                  type="button"
                  className="w-full px-5 py-4 text-left transition-colors hover:bg-secondary/60"
                  onClick={() => navigate(buildCalculatorPrefill(item))}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground">{item.symbol}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(item.orderType ?? "—").replace("_", " ")} ·{" "}
                        {item.lotSize.toFixed(2)} lots · risk {item.riskPercent}%
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        {formatDistanceToNow(item.createdAt, { addSuffix: true })}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-brand">Reopen</span>
                  </div>
                </button>
                <div className="border-t border-border/40 px-5 py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs text-destructive hover:bg-destructive/10"
                    onClick={() => void handleDelete(item.id)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              </article>
            ))}
            {canLoadMore && (
              <Button
                variant="outline"
                className="w-full rounded-xl"
                disabled={isLoadingMore}
                onClick={() => loadMore()}
              >
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default CalculatorHistory;
