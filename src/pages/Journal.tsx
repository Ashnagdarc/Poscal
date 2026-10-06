import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock3, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { JournalAnalyticsTabs, type JournalTab } from "@/components/journal/JournalAnalyticsTabs";
import { JournalOnboarding } from "@/components/journal/JournalOnboarding";
import { JournalSwitcher } from "@/components/journal/JournalSwitcher";
import { JournalTour } from "@/components/journal/JournalTour";
import { LogTradeChoiceSheet } from "@/components/journal/LogTradeChoiceSheet";
import { ManualTradeSheet } from "@/components/journal/ManualTradeSheet";
import { ResultsCalendar, ResultsLegend } from "@/components/journal/ResultsCalendar";
import { PageHeader } from "@/components/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { useActionError } from "@/contexts/ActionErrorContext";
import { useJournalTradeFacts } from "@/hooks/queries/use-journal-trade-facts";
import { useJournalTradeStats } from "@/hooks/queries/use-journal-trade-stats";
import {
  useAddTradeMutation,
  useDeleteTradeMutation,
  usePaginatedTradesQuery,
  useTradesQuery,
  useUpdateTradeMutation,
  type ManualTradeInput,
} from "@/hooks/queries/use-trades-query";
import {
  buildResultDaySummaries,
  startOfDay,
  toDateKey,
} from "@/lib/historyResults";
import type { JournalTrade } from "@/lib/convexJournal";
import { preferencesApi } from "@/lib/api";
import {
  evaluateEquityMilestone,
  evaluateRiskAlert,
  evaluateTradeCountMilestone,
  parseDefaultRiskPercent,
} from "@/lib/tradingAlerts";
import { detectBrowserTimeZone } from "@/lib/timezones";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const formatPnl = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
};

const Journal = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showErrorFromUnknown } = useActionError();
  const {
    activeJournal,
    needsOnboarding,
    isLoading: isJournalsLoading,
  } = useJournal();

  const [pageSection, setPageSection] = useState<"today" | "trades" | "notebook">("today");
  const [journalTab, setJournalTab] = useState<JournalTab>("overview");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));
  const [isLogTradeChooserOpen, setIsLogTradeChooserOpen] = useState(false);
  const [isTradeSheetOpen, setIsTradeSheetOpen] = useState(false);
  const [openNotebookAfterManualSave, setOpenNotebookAfterManualSave] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<JournalTrade | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<JournalTrade | null>(null);
  const [preferredTimeZone, setPreferredTimeZone] = useState(
    () => localStorage.getItem("preferredTimezone") || detectBrowserTimeZone(),
  );
  const [riskAlertsEnabled, setRiskAlertsEnabled] = useState(true);
  const [milestoneAlertsEnabled, setMilestoneAlertsEnabled] = useState(true);

  const { data: manualTrades = [], isLoading: isManualTradesLoading } = useTradesQuery();
  const {
    data: paginatedManualTrades,
    canLoadMore: canLoadMoreTrades,
    isLoadingMore: isLoadingMoreTrades,
    loadMore: loadMoreTrades,
  } = usePaginatedTradesQuery();

  const addTradeMutation = useAddTradeMutation();
  const updateTradeMutation = useUpdateTradeMutation();
  const deleteTradeMutation = useDeleteTradeMutation();
  const { stats: serverTradeStats, isBackfilling: isTradeStatsBackfilling } = useJournalTradeStats();

  const {
    ready: areTradeFactsReady,
    daySummaries: factDaySummaries,
    performanceSummary: tradePerformanceSummary,
  } = useJournalTradeFacts({
    calendarMonth,
    selectedMonthKey: undefined,
    selectedDateKey: undefined,
    timeZone: preferredTimeZone,
  });

  const startingBalance = activeJournal?.startingBalance ?? 0;
  const today = useMemo(() => startOfDay(new Date()), []);

  const fallbackDaySummaries = useMemo(
    () => buildResultDaySummaries([], manualTrades, preferredTimeZone),
    [manualTrades, preferredTimeZone],
  );
  const resultDaySummaries = areTradeFactsReady ? factDaySummaries : fallbackDaySummaries;
  const todaySummary = resultDaySummaries.get(toDateKey(today)) ?? null;

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    void preferencesApi.get()
      .then((prefs) => {
        if (!mounted || !prefs) return;
        if (prefs.timezone) {
          setPreferredTimeZone(prefs.timezone);
          localStorage.setItem("preferredTimezone", prefs.timezone);
        }
        setRiskAlertsEnabled(prefs.trading_risk_alerts_enabled);
        setMilestoneAlertsEnabled(prefs.trading_milestone_alerts_enabled);
        if (prefs.default_risk_percent != null) {
          localStorage.setItem("defaultRisk", String(prefs.default_risk_percent));
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const openLogChooser = () => {
    setTradeToEdit(null);
    setIsLogTradeChooserOpen(true);
  };

  const handleSaveManualTrade = async (tradeInput: ManualTradeInput) => {
    try {
      const previousClosed = manualTrades.filter(
        (trade) =>
          trade.status === "closed"
          && trade.pnl != null
          && Number.isFinite(trade.pnl),
      );
      const previousTotalPnl = previousClosed.reduce((sum, trade) => sum + (trade.pnl as number), 0);
      const editingClosedPnl =
        tradeToEdit
        && tradeToEdit.status === "closed"
        && tradeToEdit.pnl != null
        && Number.isFinite(tradeToEdit.pnl)
          ? tradeToEdit.pnl
          : 0;

      let createdTrade: JournalTrade | null = null;

      if (tradeToEdit) {
        await updateTradeMutation.mutateAsync({ id: tradeToEdit.id, ...tradeInput });
        toast.success("Trade updated");
      } else {
        createdTrade = await addTradeMutation.mutateAsync(tradeInput);
        toast.success(openNotebookAfterManualSave ? "Trade saved. Add your charts and notes." : "Trade saved");
      }

      const defaultRisk = parseDefaultRiskPercent(localStorage.getItem("defaultRisk"));
      if (riskAlertsEnabled) {
        const riskAlert = evaluateRiskAlert(tradeInput.risk_percent, defaultRisk);
        if (riskAlert) toast.warning(riskAlert.body);
      }

      if (milestoneAlertsEnabled) {
        const nextClosedCount =
          tradeInput.status === "closed" && tradeInput.pnl != null && Number.isFinite(tradeInput.pnl)
            ? previousClosed.length - (editingClosedPnl ? 1 : 0) + 1
            : previousClosed.length - (editingClosedPnl ? 1 : 0);
        const nextTotalPnl =
          tradeInput.status === "closed" && tradeInput.pnl != null && Number.isFinite(tradeInput.pnl)
            ? previousTotalPnl - editingClosedPnl + tradeInput.pnl
            : previousTotalPnl - editingClosedPnl;

        const countAlert = evaluateTradeCountMilestone(nextClosedCount);
        if (countAlert) toast.message(countAlert.title, { description: countAlert.body });

        const equityAlert = evaluateEquityMilestone(startingBalance, previousTotalPnl, nextTotalPnl);
        if (equityAlert) toast.message(equityAlert.title, { description: equityAlert.body });
      }

      setIsTradeSheetOpen(false);
      setTradeToEdit(null);

      const shouldOpenNotebook = openNotebookAfterManualSave && createdTrade;
      setOpenNotebookAfterManualSave(false);
      if (shouldOpenNotebook) {
        navigate(`/journal/trade/${createdTrade.id}`);
      }
    } catch (error) {
      console.error("[journal] Failed to save manual trade", error);
      showErrorFromUnknown(error, {
        title: "Couldn't save trade",
        fallbackMessage: "We couldn’t save that trade. Check the details and try again.",
        code: "JNL-SAVE",
      });
    }
  };

  const handleDeleteManualTrade = async () => {
    if (!tradeToDelete) return;

    try {
      await deleteTradeMutation.mutateAsync(tradeToDelete.id);
      toast.success("Trade deleted");
    } catch (error) {
      console.error("[journal] Failed to delete manual trade", error);
      showErrorFromUnknown(error, {
        title: "Couldn't delete trade",
        fallbackMessage: "We couldn’t delete that trade.",
        code: "JNL-DEL",
      });
    } finally {
      setTradeToDelete(null);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-background pb-6">
      <PageHeader
        title="Journal"
        subtitle={
          needsOnboarding
            ? "Set up your first journal"
            : pageSection === "today"
              ? "Log, review, and learn"
              : pageSection === "trades"
                ? `${serverTradeStats?.totalTrades ?? manualTrades.length} trade${(serverTradeStats?.totalTrades ?? manualTrades.length) === 1 ? "" : "s"}`
                : "Charts, reasoning, and trade reviews"
        }
        icon={<BookOpen className="h-5 w-5" />}
      />

      <main id="main-content" className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 sm:px-6 md:max-w-3xl">
        {isJournalsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        ) : needsOnboarding ? (
          <JournalOnboarding mode="first" />
        ) : (
          <>
            <div className="mb-4" data-tour-id="journal-switcher">
              <JournalSwitcher />
            </div>

            <section className="mb-4 rounded-2xl bg-secondary p-2" data-tour-id="journal-tabs">
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "today", label: "Today" },
                    { id: "trades", label: "Trades" },
                    { id: "notebook", label: "Notebook" },
                  ] as const
                ).map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setPageSection(section.id)}
                    className={`h-11 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                      pageSection === section.id
                        ? "bg-background text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </section>

            {pageSection === "today" ? (
              <div className="space-y-4 animate-slide-up">
                <button
                  type="button"
                  onClick={openLogChooser}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-sm font-bold text-brand-foreground shadow-sm transition active:scale-[0.99]"
                >
                  <Plus className="h-4 w-4" />
                  Log Trade
                </button>

                <section className="grid grid-cols-2 gap-3 rounded-2xl bg-secondary p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Today</p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {todaySummary?.label ?? "No result"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Trades</p>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {todaySummary?.tradeCount ?? 0}
                    </p>
                  </div>
                </section>

                <section
                  className="overflow-hidden rounded-2xl bg-secondary p-3 sm:p-4"
                  data-tour-id="journal-results"
                >
                  <div className="mb-3">
                    <h2 className="text-base font-bold text-foreground">Calendar</h2>
                    <p className="text-xs text-muted-foreground">
                      Tap a day to open its journal.
                    </p>
                  </div>
                  <ResultsCalendar
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selectedDate={undefined}
                    onSelectDate={(date) => {
                      if (date) navigate(`/journal/day/${toDateKey(date)}`);
                    }}
                    summaries={resultDaySummaries}
                    today={today}
                  />
                  <ResultsLegend />
                </section>

                <button
                  type="button"
                  onClick={() => navigate(`/journal/day/${toDateKey(today)}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-secondary p-4 text-left transition active:scale-[0.99]"
                  data-tour-id="journal-session"
                >
                  <div>
                    <p className="text-sm font-bold text-foreground">Today&apos;s journal</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a plan, review the day, or open today&apos;s trade notebooks.
                    </p>
                  </div>
                  <BookOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              </div>
            ) : null}

            {pageSection === "trades" ? (
              <div className="space-y-4">
                <section className="rounded-2xl bg-secondary px-4 py-3" data-tour-id="journal-trades">
                  <h2 className="text-base font-bold text-foreground">Trades &amp; analytics</h2>
                  <p className="text-xs text-muted-foreground">
                    Your logged trades only. Calculator history is not included.
                  </p>
                </section>

                <JournalAnalyticsTabs
                  trades={manualTrades}
                  isLoading={isManualTradesLoading}
                  activeTab={journalTab}
                  onTabChange={setJournalTab}
                  startingBalance={startingBalance}
                  timeZone={preferredTimeZone}
                  serverStats={serverTradeStats}
                  isStatsBackfilling={isTradeStatsBackfilling}
                  serverPerformance={tradePerformanceSummary}
                  feedTrades={paginatedManualTrades}
                  canLoadMoreTrades={canLoadMoreTrades}
                  isLoadingMoreTrades={isLoadingMoreTrades}
                  onLoadMoreTrades={loadMoreTrades}
                  onAddTrade={openLogChooser}
                  onEditTrade={(trade) => {
                    setTradeToEdit(trade);
                    setOpenNotebookAfterManualSave(false);
                    setIsTradeSheetOpen(true);
                  }}
                  onDeleteTrade={setTradeToDelete}
                />
              </div>
            ) : null}

            {pageSection === "notebook" ? (
              <div className="space-y-3 animate-slide-up" data-tour-id="journal-notebook">
                {paginatedManualTrades.length === 0 ? (
                  <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30 px-6 text-center">
                    <BookOpen className="mb-3 h-9 w-9 text-muted-foreground opacity-40" />
                    <p className="font-semibold text-foreground">No trade notebooks yet</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Log any trade, then add as much or as little context as you want.
                    </p>
                    <button
                      type="button"
                      onClick={openLogChooser}
                      className="mt-5 h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground"
                    >
                      Log Trade
                    </button>
                  </section>
                ) : (
                  <>
                    {paginatedManualTrades.map((trade) => {
                      const direction =
                        trade.direction === "sell" || trade.direction === "short" ? "Short" : "Long";
                      const notebookStatus =
                        trade.journal_status === "complete"
                          ? "Complete"
                          : trade.journal_status === "draft"
                            ? "In progress"
                            : "Add notes & charts";

                      return (
                        <button
                          key={trade.id}
                          type="button"
                          onClick={() => navigate(`/journal/trade/${trade.id}`)}
                          className="w-full rounded-2xl bg-secondary p-4 text-left transition active:scale-[0.99]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-bold text-foreground">{trade.pair}</h3>
                                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  {direction}
                                </span>
                                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                                  {trade.status}
                                </span>
                              </div>
                              <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <Clock3 className="h-3 w-3" />
                                <span>{formatDate(trade.entry_date ?? trade.created_at)}</span>
                              </div>
                            </div>

                            <p
                              className={`shrink-0 text-sm font-bold ${
                                (trade.pnl ?? 0) > 0
                                  ? "text-emerald-400"
                                  : (trade.pnl ?? 0) < 0
                                    ? "text-red-400"
                                    : "text-foreground"
                              }`}
                            >
                              {formatPnl(trade.pnl)}
                            </p>
                          </div>

                          <div className="mt-3 rounded-xl bg-background px-3 py-2.5">
                            <p className="text-[11px] font-semibold text-foreground">{notebookStatus}</p>
                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                              {trade.journal_preview || trade.notes || "Open the notebook to add before/after charts, reasoning, and lessons."}
                            </p>
                          </div>
                        </button>
                      );
                    })}

                    {canLoadMoreTrades ? (
                      <button
                        type="button"
                        onClick={loadMoreTrades}
                        disabled={isLoadingMoreTrades}
                        className="h-11 w-full rounded-xl bg-secondary text-sm font-semibold text-foreground disabled:opacity-60"
                      >
                        {isLoadingMoreTrades ? "Loading…" : "Load older notebook entries"}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}

            <JournalTour
              enabled={!isJournalsLoading && !needsOnboarding}
              pageSection={pageSection}
              onSectionChange={setPageSection}
            />
          </>
        )}
      </main>

      <ConfirmDialog
        isOpen={!!tradeToDelete}
        onClose={() => setTradeToDelete(null)}
        onConfirm={() => void handleDeleteManualTrade()}
        title="Delete Trade"
        description="Remove this trade from your journal?"
        confirmText="Delete"
        variant="destructive"
      />

      <LogTradeChoiceSheet
        open={isLogTradeChooserOpen}
        onOpenChange={setIsLogTradeChooserOpen}
        onManual={() => {
          setIsLogTradeChooserOpen(false);
          setTradeToEdit(null);
          setOpenNotebookAfterManualSave(true);
          setIsTradeSheetOpen(true);
        }}
        onAutomatic={() => {
          setIsLogTradeChooserOpen(false);
          navigate("/calculator?journalLog=1");
        }}
      />

      <ManualTradeSheet
        open={isTradeSheetOpen}
        onOpenChange={(open) => {
          setIsTradeSheetOpen(open);
          if (!open) {
            setTradeToEdit(null);
            setOpenNotebookAfterManualSave(false);
          }
        }}
        trade={tradeToEdit}
        isSaving={addTradeMutation.isPending || updateTradeMutation.isPending}
        onSave={handleSaveManualTrade}
      />
    </div>
  );
};

export default Journal;
