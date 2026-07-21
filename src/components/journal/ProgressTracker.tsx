import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Flame,
  Loader2,
  Save,
} from "lucide-react";
import { ActivityHeatmap } from "@/components/journal/ActivityHeatmap";
import { SessionDatePicker } from "@/components/journal/SessionDatePicker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  useProgressDayQuery,
  useProgressSessionsQuery,
  useSaveProgressSessionMutation,
} from "@/hooks/queries/use-progress-query";
import type { JournalTrade } from "@/lib/convexJournal";
import { computeDailyPnl, formatJournalMoney, formatJournalPercent } from "@/lib/journalAnalytics";
import {
  buildJournalHeatmap,
  buildProfitHeatmap,
  buildTasksHeatmap,
  computeStreak,
  computeTaskStats,
  createEmptySession,
  formatProgressDateKey,
  type ProgressPhase,
  type ProgressSession,
  type TaskPhase,
} from "@/lib/progressSessions";
import { toast } from "sonner";

type TrackerHeatmapTab = "journal" | "tasks" | "profit";

interface ProgressTrackerProps {
  trades: JournalTrade[];
}

const PHASE_LABELS: Record<TaskPhase, string> = {
  pre_market: "Pre-Market",
  session: "Session",
  post_market: "Post-Market",
};

export const ProgressTracker = ({ trades }: ProgressTrackerProps) => {
  const { currency } = useCurrency();
  const [dateKey, setDateKey] = useState(() => formatProgressDateKey(new Date()));
  const [heatmapTab, setHeatmapTab] = useState<TrackerHeatmapTab>("journal");
  const [draft, setDraft] = useState<ProgressSession | null>(null);

  const dayQuery = useProgressDayQuery(dateKey);
  const sessionsQuery = useProgressSessionsQuery();
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

  const sessions = sessionsQuery.data ?? [];
  const session = draft ?? createEmptySession(dateKey);
  const taskStats = computeTaskStats(session.tasks);

  const dailyPnl = useMemo(() => computeDailyPnl(trades), [trades]);
  const dayTrades = useMemo(() => {
    return trades.filter((trade) => {
      const raw = trade.exit_date ?? trade.entry_date ?? trade.created_at;
      if (!raw) return false;
      return formatProgressDateKey(new Date(raw)) === dateKey;
    });
  }, [trades, dateKey]);

  const dayPnl = dayTrades
    .filter((trade) => trade.status === "closed" && trade.pnl !== null && trade.pnl !== undefined)
    .reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);

  const dayWins = dayTrades.filter((trade) => (trade.pnl ?? 0) > 0).length;
  const dayClosed = dayTrades.filter((trade) => trade.status === "closed").length;
  const dayWinRate = dayClosed ? (dayWins / dayClosed) * 100 : 0;

  const journalHeatmap = useMemo(() => buildJournalHeatmap(sessions), [sessions]);
  const tasksHeatmap = useMemo(() => buildTasksHeatmap(sessions), [sessions]);
  const profitHeatmap = useMemo(() => buildProfitHeatmap(dailyPnl), [dailyPnl]);

  const activeHeatmap =
    heatmapTab === "journal"
      ? journalHeatmap
      : heatmapTab === "tasks"
        ? tasksHeatmap
        : profitHeatmap;

  const streak = useMemo(() => {
    if (heatmapTab === "journal") {
      return computeStreak(sessions, (item) => item.journalCreated);
    }
    if (heatmapTab === "tasks") {
      return computeStreak(sessions, (item) => {
        const stats = computeTaskStats(item.tasks);
        return stats.completed > 0;
      });
    }
    return { current: 0, best: 0 };
  }, [heatmapTab, sessions]);

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
      toast.error("Failed to save day");
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
            <h2 className="text-base font-bold text-foreground">Today&apos;s Session</h2>
            <p className="text-xs text-muted-foreground">Notes, checklist, and discipline heatmaps</p>
          </div>
          <div className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground">
            {taskStats.completed}/{taskStats.total}
          </div>
        </div>

        <div className="mt-3">
          <SessionDatePicker dateKey={dateKey} onDateChange={setDateKey} />
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

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl bg-secondary p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1">
              {(["journal", "tasks", "profit"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setHeatmapTab(tab)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-all ${
                    heatmapTab === tab
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab === "profit" ? "Profit" : tab}
                </button>
              ))}
            </div>
            {heatmapTab !== "profit" ? (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  {streak.current}d
                </span>
                <span>Best {streak.best}</span>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-2 sm:p-3">
            <ActivityHeatmap
              days={activeHeatmap}
              selectedDateKey={dateKey}
              onSelectDay={setDateKey}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
            {heatmapTab === "journal" ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-orange-500" /> Logged
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-border bg-secondary/80" /> Empty
                </span>
              </>
            ) : null}
            {heatmapTab === "tasks" ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" /> Done
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-orange-400" /> Partial
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] border border-border bg-secondary/80" /> None
                </span>
              </>
            ) : null}
            {heatmapTab === "profit" ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500" /> Win
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-slate-400" /> Flat
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-[2px] bg-red-500" /> Loss
                </span>
              </>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
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
                <span className="text-sm text-muted-foreground">Trades</span>
                <span className="text-sm font-bold text-foreground">{dayTrades.length}</span>
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
