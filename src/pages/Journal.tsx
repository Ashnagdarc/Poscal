import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Calculator, Camera, Clock3, Copy, MoreHorizontal, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useJournal } from "@/contexts/JournalContext";
import { PageHeader } from "@/components/PageHeader";
import { JournalAnalyticsTabs, type JournalTab } from "@/components/journal/JournalAnalyticsTabs";
import { JournalOnboarding } from "@/components/journal/JournalOnboarding";
import { JournalSwitcher } from "@/components/journal/JournalSwitcher";
import { JournalTour } from "@/components/journal/JournalTour";
import { ManualTradeSheet } from "@/components/journal/ManualTradeSheet";
import { ProgressTracker } from "@/components/journal/ProgressTracker";
import { ResultsCalendar, ResultsLegend } from "@/components/journal/ResultsCalendar";
import { TradingGrowthChart } from "@/components/journal/TradingGrowthChart";
import { ReturnsCalendar } from "@/components/ui/returns-calendar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  deleteJournalEntry,
  loadJournalEntries,
  type SavedCalculationOrderType,
  type JournalEntry,
  type SavedCalculationStatus,
  updateJournalEntry,
} from "@/lib/calculatorHistory";
import type { JournalTrade } from "@/lib/convexJournal";
import {
  useAddTradeMutation,
  useDeleteTradeMutation,
  useTradesQuery,
  useUpdateTradeMutation,
  type ManualTradeInput,
} from "@/hooks/queries/use-trades-query";
import { toast } from "sonner";
import {
  buildMonthlyReturnsGrid,
  buildResultDaySummaries,
  isSameDay,
  startOfDay,
  toDateKey,
} from "@/lib/historyResults";
import { formatProgressDateKey } from "@/lib/progressSessions";

const ORDER_TYPE_LABELS: Record<SavedCalculationOrderType, string> = {
  buy: "Buy",
  sell: "Sell",
  buy_limit: "Buy Limit",
  sell_limit: "Sell Limit",
  buy_stop: "Buy Stop",
  sell_stop: "Sell Stop",
};

const formatOrderType = (orderType?: SavedCalculationOrderType | null) => {
  if (!orderType) return "Manual";
  return ORDER_TYPE_LABELS[orderType] ?? orderType;
};

const RESULT_OPTIONS: Array<{ value: SavedCalculationStatus; label: string }> = [
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "breakeven", label: "Breakeven" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_META: Record<SavedCalculationStatus, { label: string; className: string }> = {
  open: {
    label: "Open",
    className: "bg-background text-foreground",
  },
  win: {
    label: "Win",
    className: "bg-emerald-500/15 text-emerald-400",
  },
  loss: {
    label: "Loss",
    className: "bg-red-500/15 text-red-400",
  },
  breakeven: {
    label: "BE",
    className: "bg-slate-500/15 text-slate-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground",
  },
};

const formatPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: value >= 100 ? 2 : 4,
    maximumFractionDigits: value >= 100 ? 2 : 5,
  });
};

const formatMoney = (value: number | null | undefined, decimals = 2) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const parseNumericInput = (value: string) => {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const Journal = () => {
  const { user } = useAuth();
  const {
    activeJournal,
    activeJournalId,
    needsOnboarding,
    isLoading: isJournalsLoading,
  } = useJournal();
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const [journalTab, setJournalTab] = useState<JournalTab>("overview");
  const [pageSection, setPageSection] = useState<"today" | "trades" | "history">("today");
  const [isTradeSheetOpen, setIsTradeSheetOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<JournalTrade | null>(null);
  const [tradeToDelete, setTradeToDelete] = useState<JournalTrade | null>(null);
  const { data: manualTrades = [], isLoading: isManualTradesLoading } = useTradesQuery();
  const addTradeMutation = useAddTradeMutation();
  const updateTradeMutation = useUpdateTradeMutation();
  const deleteTradeMutation = useDeleteTradeMutation();
  const [activeView, setActiveView] = useState<"heatmap" | "calendar">("calendar");
  const [items, setItems] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<JournalEntry | null>(null);
  const [itemToDelete, setItemToDelete] = useState<JournalEntry | null>(null);
  const [itemForResult, setItemForResult] = useState<JournalEntry | null>(null);
  const [resultStatus, setResultStatus] = useState<SavedCalculationStatus>("win");
  const [pnlAmountInput, setPnlAmountInput] = useState("");
  const [resultRInput, setResultRInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(undefined);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | undefined>(undefined);
  const [sessionDateKey, setSessionDateKey] = useState(() => formatProgressDateKey(new Date()));

  const startingBalance = activeJournal?.startingBalance ?? 0;

  useEffect(() => {
    let isMounted = true;

    const loadItems = async () => {
      if (!user?.id || !activeJournalId) {
        if (isMounted) {
          setItems([]);
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const nextItems = await loadJournalEntries(user.id, activeJournalId);
        if (isMounted) {
          setItems(nextItems);
        }
      } catch (error) {
        console.error("[journal] Failed to load saved calculations", error);
        if (isMounted) {
          setItems([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadItems();

    return () => {
      isMounted = false;
    };
  }, [user?.id, activeJournalId]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const resultDaySummaries = useMemo(
    () => buildResultDaySummaries(items, manualTrades),
    [items, manualTrades],
  );

  const monthlyReturns = useMemo(
    () => buildMonthlyReturnsGrid(items, manualTrades, today, startingBalance),
    [items, manualTrades, today, startingBalance],
  );

  const filteredItems = useMemo(() => {
    if (selectedMonthKey) {
      return items.filter((item) => {
        if (item.status === "open") return false;
        const resultDate = item.closedAt ?? item.openedAt ?? item.updatedAt ?? item.createdAt;
        return toDateKey(resultDate).startsWith(selectedMonthKey);
      });
    }

    if (!selectedCalendarDate) {
      return items;
    }

    const targetDay = startOfDay(selectedCalendarDate);
    return items.filter((item) => {
      const resultDate = item.closedAt ?? item.openedAt ?? item.updatedAt ?? item.createdAt;
      return item.status !== "open" && isSameDay(resultDate, targetDay);
    });
  }, [items, selectedCalendarDate, selectedMonthKey]);

  const filteredManualTrades = useMemo(() => {
    if (selectedMonthKey) {
      return manualTrades.filter((trade) => {
        if (trade.status !== "closed") return false;
        const raw = trade.exit_date ?? trade.entry_date ?? trade.created_at;
        return toDateKey(new Date(raw)).startsWith(selectedMonthKey);
      });
    }

    if (!selectedCalendarDate) {
      return [];
    }

    const targetDay = startOfDay(selectedCalendarDate);
    return manualTrades.filter((trade) => {
      if (trade.status !== "closed") return false;
      const raw = trade.exit_date ?? trade.entry_date ?? trade.created_at;
      return isSameDay(new Date(raw), targetDay);
    });
  }, [manualTrades, selectedCalendarDate, selectedMonthKey]);

  const openResultEditor = (item: JournalEntry) => {
    setItemForResult(item);
    setResultStatus(item.status === "open" ? "win" : item.status);
    setPnlAmountInput(item.pnlAmount !== null && item.pnlAmount !== undefined ? String(item.pnlAmount) : "");
    setResultRInput(item.resultR !== null && item.resultR !== undefined ? String(item.resultR) : "");
    setNoteInput(item.note ?? "");
    setScreenshotPreview(item.screenshotUrls?.[0] ?? null);
  };

  const resetResultEditor = () => {
    setItemForResult(null);
    setPnlAmountInput("");
    setResultRInput("");
    setNoteInput("");
    setScreenshotPreview(null);
    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = "";
    }
  };

  const handleScreenshotSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setScreenshotPreview(result);
    };
    reader.onerror = () => {
      toast.error("Failed to load screenshot");
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;

    try {
      const nextItems = await deleteJournalEntry(itemToDelete.id, user?.id);
      setItems(nextItems);
      if (selectedItem?.id === itemToDelete.id) {
        setSelectedItem(null);
      }
      toast.success("Calculation deleted");
    } catch (error) {
      console.error("[journal] Failed to delete calculation", error);
      toast.error("Failed to delete calculation");
    } finally {
      setItemToDelete(null);
    }
  };

  const handleSaveResult = async () => {
    if (!itemForResult) return;

    try {
      const nextItems = await updateJournalEntry(
        itemForResult.id,
        {
          status: resultStatus,
          pnlAmount: parseNumericInput(pnlAmountInput),
          resultR: parseNumericInput(resultRInput),
          note: noteInput.trim() || null,
          screenshotUrls: screenshotPreview ? [screenshotPreview] : null,
          closedAt: resultStatus === "open" ? null : new Date(),
        },
        user?.id,
      );
      setItems(nextItems);
      setSelectedItem(nextItems.find((item) => item.id === itemForResult.id) ?? null);
      resetResultEditor();
      toast.success("Trade result saved");
    } catch (error) {
      console.error("[journal] Failed to save trade result", error);
      toast.error("Failed to save trade result");
    }
  };

  const handleSaveManualTrade = async (tradeInput: ManualTradeInput) => {
    try {
      if (tradeToEdit) {
        await updateTradeMutation.mutateAsync({ id: tradeToEdit.id, ...tradeInput });
        toast.success("Trade updated");
      } else {
        await addTradeMutation.mutateAsync(tradeInput);
        toast.success("Trade saved");
      }

      setIsTradeSheetOpen(false);
      setTradeToEdit(null);
    } catch (error) {
      console.error("[journal] Failed to save manual trade", error);
      toast.error("Failed to save trade");
    }
  };

  const handleDeleteManualTrade = async () => {
    if (!tradeToDelete) return;

    try {
      await deleteTradeMutation.mutateAsync(tradeToDelete.id);
      toast.success("Trade deleted");
    } catch (error) {
      console.error("[journal] Failed to delete manual trade", error);
      toast.error("Failed to delete trade");
    } finally {
      setTradeToDelete(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <PageHeader
        title="Journal"
        subtitle={
          needsOnboarding
            ? "Set up your first journal"
            : pageSection === "today"
              ? "Growth, results, and session notes"
              : pageSection === "trades"
                ? `${manualTrades.length} manual trade${manualTrades.length === 1 ? "" : "s"}`
                : `${items.length} saved calculation${items.length === 1 ? "" : "s"}`
        }
        icon={<BookOpen className="h-5 w-5" />}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-4 sm:px-6 md:max-w-3xl">
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
                { id: "history", label: "History" },
              ] as const
            ).map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setPageSection(section.id)}
                className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
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
            <div data-tour-id="journal-growth">
              <TradingGrowthChart
                trades={manualTrades}
                calculatorResults={items}
                startingBalance={startingBalance}
              />
            </div>

            <section
              className="overflow-hidden rounded-2xl bg-secondary p-3 sm:p-4"
              data-tour-id="journal-results"
            >
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-background/60 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView("heatmap");
                    setSelectedCalendarDate(undefined);
                  }}
                  className={`h-10 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] ${
                    activeView === "heatmap"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Returns
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveView("calendar");
                    setSelectedMonthKey(undefined);
                  }}
                  className={`h-10 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] ${
                    activeView === "calendar"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  }`}
                >
                  Calendar
                </button>
              </div>

              {activeView === "heatmap" ? (
                <ReturnsCalendar
                  title="Monthly returns"
                  hint="tap a month to filter · year = compounded"
                  years={monthlyReturns.years}
                  returns={monthlyReturns.returns}
                  selectedMonthKey={selectedMonthKey}
                  onSelectMonth={(year, monthIndex) => {
                    const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
                    setSelectedMonthKey((current) => (current === monthKey ? undefined : monthKey));
                    setSelectedCalendarDate(undefined);
                    setCalendarMonth(new Date(year, monthIndex, 1));
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Results Calendar</h2>
                    <p className="text-xs text-muted-foreground">
                      Tap a day to filter results and open that session
                    </p>
                  </div>
                  <ResultsCalendar
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    selectedDate={selectedCalendarDate}
                    onSelectDate={(date) => {
                      setSelectedCalendarDate(date);
                      setSelectedMonthKey(undefined);
                      if (date) {
                        setSessionDateKey(toDateKey(date));
                      }
                    }}
                    summaries={resultDaySummaries}
                    today={today}
                  />
                  <ResultsLegend />
                </div>
              )}
            </section>

            {selectedMonthKey || selectedCalendarDate ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-2xl bg-secondary px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedMonthKey
                        ? new Date(`${selectedMonthKey}-01T12:00:00`).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })
                        : selectedCalendarDate?.toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filteredItems.length + filteredManualTrades.length} result
                      {filteredItems.length + filteredManualTrades.length === 1 ? "" : "s"}
                      {selectedMonthKey ? " this month" : " on this day"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCalendarDate(undefined);
                      setSelectedMonthKey(undefined);
                    }}
                    className="rounded-xl bg-background px-3 py-2 text-xs font-semibold text-foreground transition-all active:scale-[0.98]"
                  >
                    Clear
                  </button>
                </div>

                {filteredItems.length === 0 && filteredManualTrades.length === 0 ? (
                  <div className="rounded-2xl bg-secondary p-5 text-center text-muted-foreground">
                    <p className="font-medium text-foreground">No results for this selection</p>
                    <p className="mt-1 text-sm">Pick another month or day.</p>
                  </div>
                ) : null}

                {filteredManualTrades.map((trade) => {
                  const pnl = trade.pnl;
                  const resultStatus =
                    pnl === null || pnl === undefined
                      ? "breakeven"
                      : pnl > 0
                        ? "win"
                        : pnl < 0
                          ? "loss"
                          : "breakeven";

                  return (
                    <article key={`trade-${trade.id}`} className="rounded-2xl bg-secondary p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-bold text-foreground">{trade.pair}</h2>
                            <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                              Trade
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_META[resultStatus].className}`}>
                              {STATUS_META[resultStatus].label}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span>{formatDate(new Date(trade.exit_date ?? trade.entry_date ?? trade.created_at))}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">P&L</p>
                          <p className={`text-lg font-bold ${
                            (pnl ?? 0) > 0
                              ? "text-emerald-400"
                              : (pnl ?? 0) < 0
                                ? "text-red-400"
                                : "text-foreground"
                          }`}>
                            {pnl === null || pnl === undefined ? "—" : `${pnl > 0 ? "+" : ""}${formatMoney(pnl, 2)}`}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {filteredItems.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-secondary p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground">{item.symbol}</h2>
                          <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground">
                            {formatOrderType(item.orderType)}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_META[item.status].className}`}>
                            {STATUS_META[item.status].label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{formatDate(item.closedAt ?? item.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">P&L</p>
                        <p className={`text-lg font-bold ${
                          (item.pnlAmount ?? 0) > 0
                            ? "text-emerald-400"
                            : (item.pnlAmount ?? 0) < 0
                              ? "text-red-400"
                              : "text-foreground"
                        }`}>
                          {item.pnlAmount === null || item.pnlAmount === undefined
                            ? "—"
                            : `${item.pnlAmount > 0 ? "+" : ""}${formatMoney(item.pnlAmount, 2)}`}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </section>
            ) : null}

            <div data-tour-id="journal-session">
              <ProgressTracker
                trades={manualTrades}
                calculatorResults={items}
                dateKey={sessionDateKey}
                onDateKeyChange={(nextDateKey) => {
                  setSessionDateKey(nextDateKey);
                  const [year, month, day] = nextDateKey.split("-").map(Number);
                  const nextDate = new Date(year, month - 1, day);
                  setSelectedCalendarDate(startOfDay(nextDate));
                  setSelectedMonthKey(undefined);
                  setCalendarMonth(startOfDay(nextDate));
                  setActiveView("calendar");
                }}
              />
            </div>
          </div>
        ) : null}

        {pageSection === "trades" ? (
          <div className="space-y-4">
            <div
              data-tour-id="journal-trades"
              className="rounded-2xl bg-secondary px-4 py-3"
            >
              <h2 className="text-base font-bold text-foreground">Trades & analytics</h2>
              <p className="text-xs text-muted-foreground">
                Overview, stats, and charts for this journal
              </p>
            </div>
            <JournalAnalyticsTabs
              trades={manualTrades}
              isLoading={isManualTradesLoading}
              activeTab={journalTab}
              onTabChange={setJournalTab}
              startingBalance={startingBalance}
              onAddTrade={() => {
                setTradeToEdit(null);
                setIsTradeSheetOpen(true);
              }}
              onEditTrade={(trade) => {
                setTradeToEdit(trade);
                setIsTradeSheetOpen(true);
              }}
              onDeleteTrade={setTradeToDelete}
            />
          </div>
        ) : null}

        {pageSection === "history" ? (
          <>
            <section className="mb-4" data-tour-id="journal-history">
              <h2 className="text-base font-bold text-foreground">Saved Calculations</h2>
              <p className="text-sm text-muted-foreground">
                Position sizes from the calculator and signals
              </p>
            </section>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="space-y-3 rounded-2xl bg-secondary p-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-6 w-28" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                      <Skeleton className="h-14 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center text-muted-foreground animate-fade-in">
                <Calculator className="mb-3 h-12 w-12 opacity-30" />
                <p className="font-medium text-foreground">No saved calculations yet</p>
                <p className="text-sm">Your completed calculator results will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4 animate-slide-up">
                {items.map((item) => (
                  <article key={item.id} className="rounded-2xl bg-secondary p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground">{item.symbol}</h2>
                          <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground">
                            {formatOrderType(item.orderType)}
                          </span>
                          <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                            {item.source === "signal" ? "Signal" : "Manual"}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_META[item.status].className}`}>
                            {STATUS_META[item.status].label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />
                          <span>{formatDate(item.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Lot Size</p>
                        <p className="text-lg font-bold text-foreground">{formatMoney(item.lotSize, 2)}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">Entry</p>
                        <p className="mt-1 font-semibold text-foreground">{formatPrice(item.entryPrice)}</p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">Stop Loss</p>
                        <p className="mt-1 font-semibold text-foreground">{formatPrice(item.stopLossPrice)}</p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">Take Profit</p>
                        <p className="mt-1 font-semibold text-foreground">{formatPrice(item.takeProfitPrice)}</p>
                      </div>
                      <div className="rounded-xl bg-background px-3 py-3">
                        <p className="text-xs text-muted-foreground">Risk</p>
                        <p className="mt-1 font-semibold text-foreground">
                          ${formatMoney(item.riskAmount, 2)} ({formatMoney(item.riskPercent, 1)}%)
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => openResultEditor(item)}
                        className="h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-brand-foreground transition-all active:scale-[0.98]"
                      >
                        {item.status === "open" ? "Mark Result" : "Edit Result"}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="flex h-11 w-11 items-center justify-center rounded-xl bg-background text-foreground transition-all active:scale-[0.98]"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedItem(item)}>
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setItemToDelete(item)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        ) : null}
          </>
        )}

        <JournalTour
          enabled={!isJournalsLoading && !needsOnboarding}
          pageSection={pageSection}
          onSectionChange={setPageSection}
        />
      </main>

      {selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background/80 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center px-6 py-8 sm:items-center">
            <div className="my-auto w-full max-w-md rounded-3xl border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedItem.symbol}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatOrderType(selectedItem.orderType)} • {selectedItem.source === "signal" ? "From signal" : "Manual"}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="h-10 w-10 rounded-xl bg-secondary text-foreground transition-all active:scale-95"
                aria-label="Close details"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Account Balance</p>
                  <p className="mt-1 font-semibold text-foreground">${formatMoney(selectedItem.accountBalance, 2)}</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Risk Amount</p>
                  <p className="mt-1 font-semibold text-foreground">${formatMoney(selectedItem.riskAmount, 2)}</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Actual Risk</p>
                  <p className="mt-1 font-semibold text-foreground">${formatMoney(selectedItem.actualRisk, 2)}</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Reward to Risk</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {selectedItem.rewardToRisk ? `1:${formatMoney(selectedItem.rewardToRisk, 2)}` : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Potential Profit</p>
                  <p className="mt-1 font-semibold text-foreground">${formatMoney(selectedItem.potentialProfit, 2)}</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Saved</p>
                  <p className="mt-1 font-semibold text-foreground">{formatDate(selectedItem.createdAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="mt-1 font-semibold text-foreground">{STATUS_META[selectedItem.status].label}</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">P/L Amount</p>
                  <p className="mt-1 font-semibold text-foreground">${formatMoney(selectedItem.pnlAmount, 2)}</p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Result R</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {selectedItem.resultR !== null && selectedItem.resultR !== undefined
                      ? `${selectedItem.resultR > 0 ? "+" : ""}${formatMoney(selectedItem.resultR, 2)}R`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Closed</p>
                  <p className="mt-1 font-semibold text-foreground">
                    {selectedItem.closedAt ? formatDate(selectedItem.closedAt) : "—"}
                  </p>
                </div>
              </div>

              {selectedItem.note && (
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Note</p>
                  <p className="mt-1 whitespace-pre-wrap font-medium text-foreground">{selectedItem.note}</p>
                </div>
              )}

              {selectedItem.screenshotUrls?.[0] && (
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Screenshot</p>
                  <img
                    src={selectedItem.screenshotUrls[0]}
                    alt={`${selectedItem.symbol} trade screenshot`}
                    className="mt-2 max-h-64 w-full rounded-xl object-cover"
                  />
                </div>
              )}

              {selectedItem.signalId && (
                <div className="rounded-xl bg-secondary px-3 py-3">
                  <p className="text-xs text-muted-foreground">Signal ID</p>
                  <p className="mt-1 font-semibold text-foreground break-all">{selectedItem.signalId}</p>
                </div>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                disabled
                className="h-11 rounded-xl bg-secondary text-sm font-semibold text-muted-foreground opacity-60"
              >
                <Copy className="mr-2 inline-block w-4 h-4" />
                Reuse
              </button>
              <button
                onClick={() => openResultEditor(selectedItem)}
                className="h-11 rounded-xl bg-secondary text-sm font-semibold text-foreground transition-all active:scale-[0.98]"
              >
                {selectedItem.status === "open" ? "Mark Result" : "Edit Result"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {itemForResult && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background/80 backdrop-blur-sm">
          <div className="flex min-h-full items-start justify-center px-6 py-8 sm:items-center">
            <div className="my-auto w-full max-w-md rounded-3xl border border-border bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {itemForResult.status === "open" ? "Mark Result" : "Edit Result"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{itemForResult.symbol}</p>
              </div>
              <button
                onClick={resetResultEditor}
                className="h-10 w-10 rounded-xl bg-secondary text-foreground transition-all active:scale-95"
                aria-label="Close result form"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Result</label>
                <select
                  value={resultStatus}
                  onChange={(event) => setResultStatus(event.target.value as SavedCalculationStatus)}
                  className="h-12 w-full rounded-xl border border-border bg-secondary px-4 text-foreground outline-none"
                >
                  {RESULT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">P/L Amount</label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={pnlAmountInput}
                    onChange={(event) => setPnlAmountInput(event.target.value)}
                    placeholder="Optional"
                    className="h-12 w-full rounded-xl border border-border bg-secondary px-4 text-foreground outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Result R</label>
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={resultRInput}
                    onChange={(event) => setResultRInput(event.target.value)}
                    placeholder="Optional"
                    className="h-12 w-full rounded-xl border border-border bg-secondary px-4 text-foreground outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Note</label>
                <textarea
                  value={noteInput}
                  onChange={(event) => setNoteInput(event.target.value)}
                  placeholder="Optional note"
                  rows={4}
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-foreground outline-none resize-none"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-foreground">Screenshot</label>
                  {screenshotPreview && (
                    <button
                      onClick={() => {
                        setScreenshotPreview(null);
                        if (screenshotInputRef.current) {
                          screenshotInputRef.current.value = "";
                        }
                      }}
                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleScreenshotSelected}
                  className="hidden"
                />

                {screenshotPreview ? (
                  <div className="overflow-hidden rounded-2xl border border-border bg-secondary">
                    <img
                      src={screenshotPreview}
                      alt="Trade screenshot preview"
                      className="max-h-72 w-full object-cover"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => screenshotInputRef.current?.click()}
                    className="flex h-28 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary text-foreground transition-all active:scale-[0.98]"
                  >
                    <Camera className="mb-2 h-5 w-5" />
                    <span className="text-sm font-semibold">Add Screenshot</span>
                    <span className="mt-1 text-xs text-muted-foreground">Gallery or camera</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={resetResultEditor}
                  className="h-12 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveResult}
                  className="h-12 rounded-xl bg-foreground text-sm font-semibold text-background transition-all active:scale-[0.98]"
                >
                  Save
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Calculation"
        description="Remove this saved calculation from your journal?"
        confirmText="Delete"
        variant="destructive"
      />

      <ConfirmDialog
        isOpen={!!tradeToDelete}
        onClose={() => setTradeToDelete(null)}
        onConfirm={() => void handleDeleteManualTrade()}
        title="Delete Trade"
        description="Remove this manual trade from your journal?"
        confirmText="Delete"
        variant="destructive"
      />

      <ManualTradeSheet
        open={isTradeSheetOpen}
        onOpenChange={(open) => {
          setIsTradeSheetOpen(open);
          if (!open) {
            setTradeToEdit(null);
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
