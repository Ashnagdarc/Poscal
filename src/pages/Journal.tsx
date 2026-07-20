import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Calculator, Camera, Clock3, Copy, MoreHorizontal, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Calendar } from "@/components/ui/calendar";
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
import { toast } from "sonner";

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

type CalendarDayTone = "positive" | "negative" | "neutral" | "missed" | "none";

interface CalendarDaySummary {
  dateKey: string;
  tradeCount: number;
  tone: CalendarDayTone;
  label: string;
}

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear()
  && left.getMonth() === right.getMonth()
  && left.getDate() === right.getDate();

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

const formatDaySummaryAmount = (value: number, suffix = "") => {
  const absoluteValue = Math.abs(value);
  const prefix = value > 0 ? "+" : value < 0 ? "-" : "";
  const fixed = absoluteValue >= 100 ? absoluteValue.toFixed(0) : absoluteValue.toFixed(1);
  return `${prefix}${fixed}${suffix}`;
};

const Journal = () => {
  const { user } = useAuth();
  const screenshotInputRef = useRef<HTMLInputElement | null>(null);
  const [activeView, setActiveView] = useState<"list" | "calendar">("list");
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

  useEffect(() => {
    let isMounted = true;

    const loadItems = async () => {
      setIsLoading(true);
      try {
        const nextItems = await loadJournalEntries(user?.id);
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
  }, [user?.id]);

  const totalSignalEntries = useMemo(
    () => items.filter((item) => item.source === "signal").length,
    [items],
  );

  const today = useMemo(() => startOfDay(new Date()), []);

  const calendarDaySummaries = useMemo(() => {
    const summaries = new Map<string, CalendarDaySummary>();
    const closedItems = items.filter((item) => item.status !== "open" && item.closedAt);

    for (const item of closedItems) {
      const closedAt = startOfDay(item.closedAt ?? item.updatedAt);
      const dateKey = toDateKey(closedAt);
      const existing = summaries.get(dateKey);
      const tradeCount = (existing?.tradeCount ?? 0) + 1;

      const dayItems = closedItems.filter((entry) => entry.closedAt && isSameDay(entry.closedAt, closedAt));

      const allHavePnl = dayItems.every((entry) => entry.pnlAmount !== null && entry.pnlAmount !== undefined);
      const allHaveResultR = dayItems.every((entry) => entry.resultR !== null && entry.resultR !== undefined);

      let tone: CalendarDayTone = "neutral";
      let label = `${tradeCount}T`;

      if (allHavePnl && dayItems.length > 0) {
        const totalPnl = dayItems.reduce((sum, entry) => sum + (entry.pnlAmount ?? 0), 0);
        tone = totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "neutral";
        label = `${totalPnl > 0 ? "+" : totalPnl < 0 ? "-" : ""}$${Math.abs(totalPnl) >= 100 ? Math.abs(totalPnl).toFixed(0) : Math.abs(totalPnl).toFixed(1)}`;
      } else if (allHaveResultR && dayItems.length > 0) {
        const totalR = dayItems.reduce((sum, entry) => sum + (entry.resultR ?? 0), 0);
        tone = totalR > 0 ? "positive" : totalR < 0 ? "negative" : "neutral";
        label = formatDaySummaryAmount(totalR, "R");
      } else {
        const wins = dayItems.filter((entry) => entry.status === "win").length;
        const losses = dayItems.filter((entry) => entry.status === "loss").length;
        tone = wins > losses ? "positive" : losses > wins ? "negative" : "neutral";
        label = wins || losses ? `W${wins}/L${losses}` : `${tradeCount}T`;
      }

      summaries.set(dateKey, {
        dateKey,
        tradeCount,
        tone,
        label,
      });
    }

    return summaries;
  }, [items]);

  const dayModifiers = useMemo(() => ({
    positive: (date: Date) => calendarDaySummaries.get(toDateKey(date))?.tone === "positive",
    negative: (date: Date) => calendarDaySummaries.get(toDateKey(date))?.tone === "negative",
    neutral: (date: Date) => calendarDaySummaries.get(toDateKey(date))?.tone === "neutral",
    missed: (date: Date) => {
      const day = startOfDay(date);
      if (day >= today) return false;
      return !calendarDaySummaries.has(toDateKey(day));
    },
  }), [calendarDaySummaries, today]);

  const filteredItems = useMemo(() => {
    if (!selectedCalendarDate) {
      return items;
    }

    const targetDay = startOfDay(selectedCalendarDate);
    return items.filter((item) => item.closedAt && isSameDay(item.closedAt, targetDay));
  }, [items, selectedCalendarDate]);

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

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      <PageHeader
        title="Journal"
        subtitle={`${items.length} saved calculation${items.length === 1 ? "" : "s"}${items.length > 0 ? ` · ${totalSignalEntries} from signals` : ""}`}
        icon={<BookOpen className="h-5 w-5" />}
      />

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-4 md:max-w-3xl">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="bg-secondary rounded-2xl p-4 space-y-3">
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
            <Calculator className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium text-foreground">No saved calculations yet</p>
            <p className="text-sm">Your completed calculator results will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4 animate-slide-up">
            <section className="rounded-2xl bg-secondary p-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveView("list")}
                  className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                    activeView === "list"
                      ? "bg-background text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setActiveView("calendar")}
                  className={`h-11 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                    activeView === "calendar"
                      ? "bg-background text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  Calendar
                </button>
              </div>
            </section>

            {activeView === "calendar" && (
              <section className="rounded-2xl bg-secondary p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Results Calendar</h2>
                    <p className="text-sm text-muted-foreground">Daily outcome markers for closed trades.</p>
                  </div>
                </div>

                <Calendar
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={selectedCalendarDate}
                  onSelect={(date) => {
                    if (!date) {
                      setSelectedCalendarDate(undefined);
                      return;
                    }

                    if (selectedCalendarDate && isSameDay(selectedCalendarDate, date)) {
                      setSelectedCalendarDate(undefined);
                      return;
                    }

                    setSelectedCalendarDate(startOfDay(date));
                  }}
                  modifiers={dayModifiers}
                  className="rounded-2xl bg-background p-3"
                  classNames={{
                    months: "flex flex-col",
                    month: "space-y-3",
                    table: "w-full border-collapse",
                    head_row: "flex",
                    head_cell: "flex-1 text-center text-[11px] font-medium text-muted-foreground",
                    row: "mt-2 flex w-full",
                    cell: "relative flex-1 p-1",
                    day: "h-14 w-full rounded-xl p-0 text-foreground hover:bg-secondary/80",
                    day_today: "bg-secondary text-foreground ring-1 ring-border",
                    day_outside: "opacity-35",
                  }}
                  modifiersClassNames={{
                    positive: "border border-emerald-500/35 bg-emerald-500/12",
                    negative: "border border-red-500/35 bg-red-500/12",
                    neutral: "border border-slate-500/35 bg-slate-500/12",
                    missed: "border border-border bg-background/60",
                  }}
                  components={{
                    DayContent: ({ date, activeModifiers }: { date: Date; activeModifiers: Record<string, boolean> }) => {
                      const summary = calendarDaySummaries.get(toDateKey(date));
                      const isFuture = startOfDay(date) > endOfDay(today);
                      const isMissed = activeModifiers.missed;
                      const isCurrentMonth = date.getMonth() === calendarMonth.getMonth();

                      return (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl">
                          <span className="text-sm font-semibold">{date.getDate()}</span>
                          {isCurrentMonth && summary && (
                            <>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  summary.tone === "positive"
                                    ? "bg-emerald-400"
                                    : summary.tone === "negative"
                                      ? "bg-red-400"
                                      : "bg-slate-300"
                                }`}
                              />
                              <span className="text-[9px] font-medium leading-none text-muted-foreground">
                                {summary.label}
                              </span>
                            </>
                          )}
                          {isCurrentMonth && !summary && isMissed && (
                            <span className="text-[10px] font-semibold leading-none text-muted-foreground">X</span>
                          )}
                          {isCurrentMonth && !summary && !isMissed && !isFuture && isSameDay(date, today) && (
                            <span className="text-[9px] font-medium leading-none text-muted-foreground">Today</span>
                          )}
                        </div>
                      );
                    },
                  }}
                />

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>Profitable day</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span>Losing day</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
                    <span className="h-2 w-2 rounded-full bg-slate-300" />
                    <span>Breakeven day</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-background px-3 py-2">
                    <span className="text-[11px] font-semibold">X</span>
                    <span>Past day with no trades</span>
                  </div>
                </div>

                {selectedCalendarDate && (
                  <div className="mt-4 rounded-2xl bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {selectedCalendarDate.toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {filteredItems.length} closed trade{filteredItems.length === 1 ? "" : "s"} on this day
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedCalendarDate(undefined)}
                        className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition-all active:scale-[0.98]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeView === "list" && selectedCalendarDate && (
              <section className="rounded-2xl bg-secondary p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedCalendarDate.toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {filteredItems.length} closed trade{filteredItems.length === 1 ? "" : "s"} on this day
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCalendarDate(undefined)}
                    className="rounded-xl bg-background px-3 py-2 text-xs font-semibold text-foreground transition-all active:scale-[0.98]"
                  >
                    Clear
                  </button>
                </div>
              </section>
            )}

            {activeView === "list" && filteredItems.length === 0 ? (
              <section className="rounded-2xl bg-secondary p-5 text-center text-muted-foreground">
                <p className="font-medium text-foreground">No closed trades for this day</p>
                <p className="mt-1 text-sm">Choose another day on the calendar to inspect results.</p>
              </section>
            ) : activeView === "list" ? filteredItems.map((item) => (
              <article key={item.id} className="bg-secondary rounded-2xl p-4">
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
                      <Clock3 className="w-3.5 h-3.5" />
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
            )) : null}
          </div>
        )}
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

    </div>
  );
};

export default Journal;
