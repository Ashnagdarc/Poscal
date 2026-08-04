import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Save,
} from "lucide-react";
import { SessionDatePicker } from "@/components/journal/SessionDatePicker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useActionError } from "@/contexts/ActionErrorContext";
import {
  useProgressDayQuery,
  useSaveProgressSessionMutation,
} from "@/hooks/queries/use-progress-query";
import type { JournalEntry } from "@/lib/calculatorHistory";
import type { JournalTrade } from "@/lib/convexJournal";
import { formatJournalMoney, formatJournalPercent } from "@/lib/journalAnalytics";
import {
  computeTaskStats,
  createEmptySession,
  formatProgressDateKey,
  type ProgressPhase,
  type ProgressSession,
  type TaskPhase,
} from "@/lib/progressSessions";
import { toast } from "sonner";

interface ProgressTrackerProps {
  trades: JournalTrade[];
  calculatorResults?: JournalEntry[];
  dateKey: string;
  onDateKeyChange: (dateKey: string) => void;
}

const PHASE_LABELS: Record<TaskPhase, string> = {
  pre_market: "Pre-Market",
  session: "Session",
  post_market: "Post-Market",
};

export const ProgressTracker = ({
  trades,
  calculatorResults = [],
  dateKey,
  onDateKeyChange,
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
  const taskStats = computeTaskStats(session.tasks);

  const dayTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (trade.status !== "closed") return false;
      const raw = trade.exit_date ?? trade.entry_date ?? trade.created_at;
      if (!raw) return false;
      return formatProgressDateKey(new Date(raw)) === dateKey;
    });
  }, [trades, dateKey]);

  const dayResults = useMemo(() => {
    return calculatorResults.filter((item) => {
      if (item.status === "open" || item.status === "cancelled") return false;
      const raw = item.closedAt ?? item.openedAt ?? item.updatedAt ?? item.createdAt;
      return formatProgressDateKey(raw) === dateKey;
    });
  }, [calculatorResults, dateKey]);

  const dayPnl = useMemo(() => {
    const tradePnl = dayTrades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
    const resultPnl = dayResults.reduce((sum, item) => sum + (item.pnlAmount ?? 0), 0);
    return tradePnl + resultPnl;
  }, [dayTrades, dayResults]);

  const dayResultCount = dayTrades.length + dayResults.length;
  const dayWins =
    dayTrades.filter((trade) => (trade.pnl ?? 0) > 0).length
    + dayResults.filter((item) => item.status === "win" || (item.pnlAmount ?? 0) > 0).length;
  const dayWinRate = dayResultCount ? (dayWins / dayResultCount) * 100 : 0;

  const notesValue =
    session.phase === "pre_market" ? session.preMarketNotes : session.postMarketNotes;

  const setPhase = (phase: ProgressPhase) => {
    setDraft((current) => ({ ...(current ?? createEmptySession(dateKey)), phase }));
  };

  const setNotes = (value: string) => {
    setDraft((current) => {
      const next = current ?? createEmptySession(dateKey);
      if (next.phase === "pre_market") {
        return { ...next, preMarketNotes: value };
      }
      return { ...next, postMarketNotes: value };
    });
  };

  const toggleTask = (taskId: string) => {
    setDraft((current) => {
      const next = current ?? createEmptySession(dateKey);
      return {
        ...next,
        tasks: next.tasks.map((task) =>
          task.id === taskId ? { ...task, completed: !task.completed } : task,
        ),
      };
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
        fallbackMessage: "We couldn’t save today’s session notes.",
        code: "PROGRESS",
      });
    }
  };

  if (dayQuery.isLoading && !draft) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-secondary p-3 sm:p-4">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-foreground">Session</h2>
            <p className="text-xs text-muted-foreground">
              Notes and checklist for the selected day
            </p>
          </div>
          <div className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
            {taskStats.completed}/{taskStats.total}
          </div>
        </div>

        <div className="mt-3">
          <SessionDatePicker dateKey={dateKey} onDateChange={onDateKeyChange} />
        </div>
      </section>

      <section className="rounded-2xl bg-secondary p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPhase("pre_market")}
            className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
              session.phase === "pre_market"
                ? "bg-background text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Pre Market
          </button>
          <button
            type="button"
            onClick={() => setPhase("post_market")}
            className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
              session.phase === "post_market"
                ? "bg-background text-foreground"
                : "text-muted-foreground"
            }`}
          >
            Post Market
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-secondary p-3 sm:p-4">
        <div className="mb-3">
          <h3 className="text-base font-bold text-foreground">
            {session.phase === "pre_market" ? "Pre-Market Notes" : "Post-Market Notes"}
          </h3>
        </div>
        <Textarea
          rows={4}
          value={notesValue}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={
            session.phase === "pre_market"
              ? "Write your pre market notes..."
              : "Write your post market notes..."
          }
          className="min-h-[100px] resize-none rounded-2xl border-border bg-background"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-secondary p-3 sm:p-4">
          <div className="mb-3">
            <h3 className="text-base font-bold text-foreground">Checklist</h3>
            <p className="text-xs text-muted-foreground">
              {taskStats.completed} of {taskStats.total} done
            </p>
          </div>

          {(["pre_market", "session", "post_market"] as const).map((phase) => {
            const phaseTasks = session.tasks.filter((task) => task.phase === phase);
            const completed = phaseTasks.filter((task) => task.completed).length;
            return (
              <div key={phase} className="mb-3 last:mb-0">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {PHASE_LABELS[phase]}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {completed}/{phaseTasks.length}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {phaseTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      className="flex w-full items-center gap-2 rounded-xl bg-background px-3 py-2.5 text-left transition-all active:scale-[0.99]"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={`text-sm ${
                          task.completed
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {task.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl bg-secondary p-3 sm:p-4">
          <h3 className="mb-3 text-base font-bold text-foreground">Day Stats</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
              <span className="text-sm text-muted-foreground">P&amp;L</span>
              <span
                className={`text-sm font-bold ${
                  dayPnl > 0 ? "text-emerald-400" : dayPnl < 0 ? "text-red-400" : "text-foreground"
                }`}
              >
                {formatJournalMoney(dayPnl, currency.symbol)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Results</span>
              <span className="text-sm font-bold text-foreground">{dayResultCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background px-3 py-2.5">
              <span className="text-sm text-muted-foreground">Win Rate</span>
              <span className="text-sm font-bold text-foreground">
                {formatJournalPercent(dayWinRate)}
              </span>
            </div>
          </div>
        </section>
      </div>

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
