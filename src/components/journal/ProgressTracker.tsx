import { useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { SessionDatePicker } from "@/components/journal/SessionDatePicker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useActionError } from "@/contexts/ActionErrorContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  useProgressDayQuery,
  useSaveProgressSessionMutation,
} from "@/hooks/queries/use-progress-query";
import type { JournalEntry } from "@/lib/calculatorHistory";
import type { JournalTrade } from "@/lib/convexJournal";
import { formatJournalMoney, formatJournalPercent, toDateKeyInTimeZone } from "@/lib/journalAnalytics";
import {
  createEmptySession,
  formatProgressDateKey,
  type ProgressPhase,
  type ProgressSession,
} from "@/lib/progressSessions";
import { toast } from "sonner";

interface ProgressTrackerProps {
  trades: JournalTrade[];
  calculatorResults?: JournalEntry[];
  dateKey: string;
  onDateKeyChange: (dateKey: string) => void;
  timeZone?: string | null;
}

export const ProgressTracker = ({
  trades,
  calculatorResults = [],
  dateKey,
  onDateKeyChange,
  timeZone = null,
}: ProgressTrackerProps) => {
  const { currency } = useCurrency();
  const { showErrorFromUnknown } = useActionError();
  const [draft, setDraft] = useState<ProgressSession | null>(null);

  const dayQuery = useProgressDayQuery(dateKey);
  const saveMutation = useSaveProgressSessionMutation();

  useEffect(() => {
    if (dayQuery.data) {
      setDraft(dayQuery.data);
      return;
    }
    if (!dayQuery.isLoading) {
      setDraft(createEmptySession(dateKey));
    }
  }, [dateKey, dayQuery.data, dayQuery.isLoading]);

  const session = draft ?? createEmptySession(dateKey);

  const dayTrades = useMemo(
    () =>
      trades.filter((trade) => {
        const raw = trade.entry_date ?? trade.exit_date ?? trade.created_at;
        if (!raw) return false;
        return toDateKeyInTimeZone(new Date(raw), timeZone) === dateKey;
      }),
    [trades, dateKey, timeZone],
  );

  // Kept only for backward compatibility with older callers. New Journal UX
  // does not surface calculator-history records here.
  const dayResults = useMemo(
    () =>
      calculatorResults.filter((item) => {
        if (item.status === "open" || item.status === "cancelled") return false;
        const raw = item.closedAt ?? item.openedAt ?? item.updatedAt ?? item.createdAt;
        return formatProgressDateKey(raw) === dateKey;
      }),
    [calculatorResults, dateKey],
  );

  const closedTrades = dayTrades.filter((trade) => trade.status === "closed");
  const dayPnl =
    closedTrades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0)
    + dayResults.reduce((sum, item) => sum + (item.pnlAmount ?? 0), 0);
  const resultCount = closedTrades.length + dayResults.length;
  const wins =
    closedTrades.filter((trade) => (trade.pnl ?? 0) > 0).length
    + dayResults.filter((item) => item.status === "win" || (item.pnlAmount ?? 0) > 0).length;
  const winRate = resultCount ? (wins / resultCount) * 100 : 0;

  const notesValue =
    session.phase === "pre_market" ? session.preMarketNotes : session.postMarketNotes;

  const setPhase = (phase: ProgressPhase) => {
    setDraft((current) => ({ ...(current ?? createEmptySession(dateKey)), phase }));
  };

  const setNotes = (value: string) => {
    setDraft((current) => {
      const next = current ?? createEmptySession(dateKey);
      return next.phase === "pre_market"
        ? { ...next, preMarketNotes: value }
        : { ...next, postMarketNotes: value };
    });
  };

  const handleSave = async () => {
    try {
      const saved = await saveMutation.mutateAsync(session);
      setDraft(saved);
      toast.success("Day saved");
    } catch (error) {
      console.error("[progressTracker] Failed to save session", error);
      showErrorFromUnknown(error, {
        title: "Couldn't save day",
        fallbackMessage: "We couldn’t save your day notes.",
        code: "PROGRESS",
      });
    }
  };

  if (dayQuery.isLoading && !draft) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-secondary p-3 sm:p-4">
        <SessionDatePicker dateKey={dateKey} onDateChange={onDateKeyChange} />

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-background/60 p-1">
          <button
            type="button"
            onClick={() => setPhase("pre_market")}
            className={`h-10 rounded-lg text-sm font-semibold transition ${
              session.phase === "pre_market"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Plan
          </button>
          <button
            type="button"
            onClick={() => setPhase("post_market")}
            className={`h-10 rounded-lg text-sm font-semibold transition ${
              session.phase === "post_market"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Review
          </button>
        </div>

        <Textarea
          rows={5}
          value={notesValue}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={
            session.phase === "pre_market"
              ? "What is your plan for this session? Add as much or as little as you want."
              : "How did the day go? What do you want to remember?"
          }
          className="mt-3 min-h-[120px] resize-y rounded-2xl border-border bg-background"
        />
      </section>

      <section className="grid grid-cols-3 gap-2 rounded-2xl bg-secondary p-3">
        <div className="rounded-xl bg-background px-3 py-3">
          <p className="text-[11px] text-muted-foreground">P&amp;L</p>
          <p className={`mt-1 text-sm font-bold ${
            dayPnl > 0 ? "text-emerald-400" : dayPnl < 0 ? "text-red-400" : "text-foreground"
          }`}>
            {formatJournalMoney(dayPnl, currency.symbol)}
          </p>
        </div>
        <div className="rounded-xl bg-background px-3 py-3">
          <p className="text-[11px] text-muted-foreground">Trades</p>
          <p className="mt-1 text-sm font-bold text-foreground">{dayTrades.length}</p>
        </div>
        <div className="rounded-xl bg-background px-3 py-3">
          <p className="text-[11px] text-muted-foreground">Win rate</p>
          <p className="mt-1 text-sm font-bold text-foreground">
            {resultCount ? formatJournalPercent(winRate) : "—"}
          </p>
        </div>
      </section>

      <Button
        className="h-12 w-full rounded-2xl"
        onClick={() => void handleSave()}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Save Day
      </Button>
    </div>
  );
};

export default ProgressTracker;
