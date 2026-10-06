import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Clock3, Plus } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { LogTradeChoiceSheet } from "@/components/journal/LogTradeChoiceSheet";
import { ManualTradeSheet } from "@/components/journal/ManualTradeSheet";
import { ProgressTracker } from "@/components/journal/ProgressTracker";
import { useJournal } from "@/contexts/JournalContext";
import { useJournalTradeFacts } from "@/hooks/queries/use-journal-trade-facts";
import {
  useAddTradeMutation,
  useCreateNotebookDraftMutation,
  useTradesQuery,
  type ManualTradeInput,
} from "@/hooks/queries/use-trades-query";
import { detectBrowserTimeZone } from "@/lib/timezones";
import { toDateKeyInTimeZone } from "@/lib/journalAnalytics";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const prettyDate = (dateKey: string) =>
  new Date(`${dateKey}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const DayJournal = () => {
  const { dateKey = "" } = useParams<{ dateKey: string }>();
  const navigate = useNavigate();
  const { activeJournal } = useJournal();
  const { data: loadedTrades = [] } = useTradesQuery();
  const addTradeMutation = useAddTradeMutation();
  const createNotebookDraftMutation = useCreateNotebookDraftMutation();

  const [showChooser, setShowChooser] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const validDateKey = DATE_KEY_RE.test(dateKey) ? dateKey : null;
  const selectedDate = validDateKey ? new Date(`${validDateKey}T12:00:00`) : new Date();
  const timeZone = localStorage.getItem("preferredTimezone") || detectBrowserTimeZone();

  const { selectedTrades: factTrades, isSelectionLoading } = useJournalTradeFacts({
    calendarMonth: selectedDate,
    selectedDateKey: validDateKey ?? undefined,
    selectedMonthKey: undefined,
    timeZone,
  });

  const dayTrades = useMemo(() => {
    if (!validDateKey) return [];
    const byId = new Map<string, (typeof loadedTrades)[number]>();

    for (const trade of factTrades) byId.set(trade.id, trade);
    for (const trade of loadedTrades) {
      const raw = trade.exit_date ?? trade.entry_date ?? trade.created_at;
      if (!raw) continue;
      if (toDateKeyInTimeZone(new Date(raw), timeZone) === validDateKey) {
        byId.set(trade.id, trade);
      }
    }

    return [...byId.values()].sort((a, b) =>
      new Date(b.entry_date ?? b.created_at).getTime() - new Date(a.entry_date ?? a.created_at).getTime(),
    );
  }, [factTrades, loadedTrades, timeZone, validDateKey]);

  const analyticsTrades = useMemo(
    () => loadedTrades.filter((trade) => trade.journal_type !== "notebook_draft"),
    [loadedTrades],
  );
  const dayPnl = dayTrades
    .filter((trade) => trade.journal_type !== "notebook_draft")
    .reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);

  const handleSave = async (input: ManualTradeInput) => {
    const trade = await addTradeMutation.mutateAsync(input);
    setShowManual(false);
    toast.success("Trade saved. Add your charts and notes.");
    navigate(`/journal/trade/${trade.id}`);
  };

  if (!validDateKey) {
    return (
      <div className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-bold text-foreground">Day unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">That journal date is not valid.</p>
        <button
          type="button"
          onClick={() => navigate("/journal")}
          className="mt-5 h-11 rounded-xl bg-secondary px-5 text-sm font-semibold"
        >
          Back to Journal
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background pb-10">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/journal")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary"
            aria-label="Back to Journal"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Day Journal</p>
            <p className="truncate text-xs text-muted-foreground">{prettyDate(validDateKey)}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 sm:px-6">
        <section className="rounded-2xl bg-secondary p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground">{activeJournal?.name ?? "Journal"}</p>
              <h1 className="mt-1 text-xl font-bold text-foreground">{prettyDate(validDateKey)}</h1>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Day P&amp;L</p>
              <p className={`mt-1 text-lg font-bold ${
                dayPnl > 0 ? "text-emerald-400" : dayPnl < 0 ? "text-red-400" : "text-foreground"
              }`}>
                {dayPnl > 0 ? "+" : ""}{dayPnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowChooser(true)}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-brand-foreground transition active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" />
            Log trade for this day
          </button>
        </section>

        <section className="rounded-2xl bg-secondary p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Trades</h2>
              <p className="text-xs text-muted-foreground">
                {dayTrades.length
                  ? `${dayTrades.length} trade${dayTrades.length === 1 ? "" : "s"} logged`
                  : "No record logged for this day"}
              </p>
            </div>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>

          {isSelectionLoading && dayTrades.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading day…</p>
          ) : dayTrades.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-semibold text-foreground">No trade logged</p>
              <p className="mt-1 text-xs text-muted-foreground">
                This day is empty. You can log a trade without filling every field.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {dayTrades.map((trade) => (
                <button
                  key={trade.id}
                  type="button"
                  onClick={() => navigate(`/journal/trade/${trade.id}`)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl bg-background px-3 py-3 text-left transition active:scale-[0.99]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-foreground">
                        {trade.journal_title?.trim() || (trade.journal_type === "notebook_draft" ? "Untitled trade" : trade.pair)}
                      </p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                        {trade.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="h-3 w-3" />
                      <span>
                        {trade.journal_type === "notebook_draft"
                          ? "Manual notebook"
                          : trade.direction === "sell" || trade.direction === "short"
                            ? "Short"
                            : "Long"}
                      </span>
                      <span>·</span>
                      <span>{trade.journal_status === "complete" ? "Journal complete" : trade.journal_status === "draft" ? "Journal in progress" : "Open notebook"}</span>
                    </div>
                  </div>
                  <p className={`shrink-0 text-sm font-bold ${
                    (trade.pnl ?? 0) > 0
                      ? "text-emerald-400"
                      : (trade.pnl ?? 0) < 0
                        ? "text-red-400"
                        : "text-foreground"
                  }`}>
                    {trade.pnl == null ? "—" : `${trade.pnl > 0 ? "+" : ""}${trade.pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 px-1">
            <h2 className="text-base font-bold text-foreground">Plan &amp; review</h2>
            <p className="text-xs text-muted-foreground">Optional notes for the whole trading day.</p>
          </div>
          <ProgressTracker
            trades={analyticsTrades}
            calculatorResults={[]}
            dateKey={validDateKey}
            timeZone={timeZone}
            onDateKeyChange={(nextDateKey) => navigate(`/journal/day/${nextDateKey}`, { replace: true })}
          />
        </section>
      </main>

      <LogTradeChoiceSheet
        open={showChooser}
        onOpenChange={setShowChooser}
        onManual={() => {
          setShowChooser(false);
          const entryDate = new Date(`${validDateKey}T12:00:00`).toISOString();
          void createNotebookDraftMutation.mutateAsync(entryDate)
            .then((draftTrade) => {
              navigate(`/journal/trade/${draftTrade.id}`);
            })
            .catch((error) => {
              console.error("[day-journal] Failed to open manual notebook", error);
              toast.error("Could not open a new notebook.");
            });
        }}
        onAutomatic={() => {
          setShowChooser(false);
          setShowManual(true);
        }}
      />

      <ManualTradeSheet
        open={showManual}
        onOpenChange={setShowManual}
        defaultDate={validDateKey}
        isSaving={addTradeMutation.isPending}
        onSave={handleSave}
      />
    </div>
  );
};

export default DayJournal;
