import { useMemo } from "react";
import {
  BarChart3,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { JournalEntry } from "@/lib/calculatorHistory";
import type { JournalTrade } from "@/lib/convexJournal";
import type { JournalTradeStatsSnapshot } from "@/hooks/queries/use-journal-trade-stats";
import type { JournalPerformanceSummary } from "@/hooks/queries/use-journal-trade-facts";
import {
  computeDailyPnl,
  computeDayOfWeekPerformance,
  computeEquityCurve,
  computeInstrumentBreakdown,
  computeJournalStats,
  computeSessionBreakdown,
  computeStrategyBreakdown,
  formatDateInTimeZone,
  formatJournalMoney,
  formatJournalPercent,
  formatJournalR,
  formatProfitFactor,
  type PerformanceBreakdownRow,
} from "@/lib/journalAnalytics";
import { cn } from "@/lib/utils";

type JournalTab = "overview" | "insights" | "charts";

interface JournalAnalyticsTabsProps {
  trades: JournalTrade[];
  requireServerAnalytics?: boolean;
  calculatorResults?: JournalEntry[];
  isLoading: boolean;
  activeTab: JournalTab;
  onTabChange: (tab: JournalTab) => void;
  onAddTrade: () => void;
  onEditTrade: (trade: JournalTrade) => void;
  onDeleteTrade: (trade: JournalTrade) => void;
  startingBalance?: number;
  /** IANA timezone for date labels / day buckets (P-029). */
  timeZone?: string | null;
  /** Complete lifetime scalar stats from the batched server-side snapshot. */
  serverStats?: JournalTradeStatsSnapshot | null;
  isStatsBackfilling?: boolean;
  feedTrades?: JournalTrade[];
  canLoadMoreTrades?: boolean;
  isLoadingMoreTrades?: boolean;
  onLoadMoreTrades?: () => void;
  serverPerformance?: JournalPerformanceSummary | null;
}

const MetricCard = ({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) => {
  const toneClass =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "negative"
        ? "text-red-400"
        : "text-foreground";

  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
};

const EmptyState = ({ onAddTrade }: { onAddTrade: () => void }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl bg-secondary px-6 py-12 text-center">
    <BarChart3 className="mb-3 h-12 w-12 opacity-30" />
    <p className="font-semibold text-foreground">No trades logged yet</p>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
      Log trades to unlock performance insights and charts.
    </p>
    <Button className="mt-4" onClick={onAddTrade}>
      <Plus className="mr-2 h-4 w-4" />
      Log Trade
    </Button>
  </div>
);

const BreakdownSection = ({
  rows,
  currencySymbol,
  emptyHint,
}: {
  rows: PerformanceBreakdownRow[];
  currencySymbol: string;
  emptyHint: string;
}) => {
  const [showAll, setShowAll] = useState(false);
  const activeRows = rows.filter((row) => row.trades > 0);
  const visibleRows = showAll ? activeRows : activeRows.slice(0, 5);

  return (
    <div className="space-y-2">
      {activeRows.length === 0 ? (
        <p className="rounded-xl bg-background/70 px-4 py-6 text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        visibleRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4 rounded-xl bg-background/70 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{row.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.trades} trade{row.trades === 1 ? "" : "s"} · {formatJournalPercent(row.winRate)} win rate
              </p>
            </div>
            <p className={cn("shrink-0 text-sm font-semibold tabular-nums", row.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
              {formatJournalMoney(row.pnl, currencySymbol)}
            </p>
          </div>
        ))
      )}
      {activeRows.length > 5 ? (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
          className="w-full rounded-xl px-3 py-2 text-sm font-medium text-brand transition-colors hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {showAll ? "Show fewer" : `Show all ${activeRows.length} categories`}
        </button>
      ) : null}
    </div>
  );
};

const formatInsightDate = (dateKey: string) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? dateKey
    : formatDateInTimeZone(date, "UTC", { month: "short", day: "numeric", year: "numeric" });
};

const InsightRow = ({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
}) => (
  <div className="flex items-start justify-between gap-4 border-b border-border/40 py-3 last:border-b-0">
    <div className="min-w-0">
      <p className="text-sm text-foreground">{label}</p>
      {hint ? <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
    <p className={cn(
      "shrink-0 text-right text-sm font-semibold tabular-nums",
      tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-foreground",
    )}>
      {value}
    </p>
  </div>
);

const TradeListItem = ({
  trade,
  currencySymbol,
  timeZone,
  onEdit,
  onDelete,
}: {
  trade: JournalTrade;
  currencySymbol: string;
  timeZone?: string | null;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const pnlTone =
    trade.pnl === null || trade.pnl === undefined
      ? "text-muted-foreground"
      : trade.pnl > 0
        ? "text-emerald-400"
        : trade.pnl < 0
          ? "text-red-400"
          : "text-muted-foreground";

  const tradeDate = trade.entry_date ? new Date(trade.entry_date) : new Date(trade.created_at);

  return (
    <div className="rounded-2xl bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-base font-semibold text-foreground">{trade.pair}</p>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase text-muted-foreground">
              {trade.direction}
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold capitalize text-muted-foreground">
              {trade.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateInTimeZone(tradeDate, timeZone, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {trade.tags ? ` · ${trade.tags}` : ""}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <div className="text-right">
            <p className={`text-sm font-bold ${pnlTone}`}>
              {formatJournalMoney(trade.pnl, currencySymbol)}
            </p>
            {trade.entry_price !== null ? (
              <p className="text-xs text-muted-foreground">Entry {trade.entry_price}</p>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-red-400" onClick={onDelete}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

const equityChartConfig = {
  equity: {
    label: "Equity",
    colors: {
      light: ["#047857", "#0ea5e9", "#8b5cf6"],
      dark: ["#34d399", "#38bdf8", "#a78bfa"],
    },
  },
} satisfies ChartConfig;

const CumulativePnlAreaChart = ({
  trades,
  calculatorResults = [],
  currencySymbol,
  startingBalance = 0,
  timeZone = null,
  equityPointsOverride = null,
}: {
  trades: JournalTrade[];
  calculatorResults?: JournalEntry[];
  currencySymbol: string;
  startingBalance?: number;
  timeZone?: string | null;
  equityPointsOverride?: Array<{
    label: string;
    value: number;
    tradePnl: number;
    pair: string | null;
    dateKey: string;
  }> | null;
}) => {
  const localEquityPoints = useMemo(
    () => computeEquityCurve(trades, calculatorResults, startingBalance, timeZone),
    [trades, calculatorResults, startingBalance, timeZone],
  );
  const equityPoints = equityPointsOverride ?? localEquityPoints;

  const chartData = useMemo(
    () =>
      equityPoints.map((point, index) => ({
        date: index === 0 ? "Start" : point.label,
        equity: Number(point.value.toFixed(2)),
      })),
    [equityPoints],
  );

  const lastValue = equityPoints[equityPoints.length - 1]?.value ?? startingBalance;
  const isPositive = lastValue >= startingBalance;
  const firstLabel = chartData[1]?.date;
  const lastLabel = chartData[chartData.length - 1]?.date;

  if (chartData.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Add more closed trades to see the equity curve
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-base font-medium tracking-tight text-foreground sm:text-lg">
            Account equity
          </span>
          <span className="max-w-[28ch] text-xs leading-snug text-muted-foreground">
            Starting {formatJournalMoney(startingBalance, currencySymbol)} · Net P&amp;L {formatJournalMoney(lastValue - startingBalance, currencySymbol)}
          </span>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "text-2xl font-semibold tracking-tight sm:text-4xl",
              isPositive ? "text-emerald-400" : "text-red-400",
            )}
          >
            {formatJournalMoney(lastValue, currencySymbol)}
          </span>
          <span className="text-xs text-muted-foreground">
            {firstLabel && lastLabel ? `${firstLabel} – ${lastLabel}` : "Net growth"}
          </span>
        </div>
      </div>

      <div className="relative mt-2 h-56 w-full sm:h-64">
        <EChartsAreaChart
          data={chartData}
          config={equityChartConfig}
          xDataKey="date"
          className="h-full w-full"
          curveType="monotone"
          enableHoverReveal
          chartOptions={{
            grid: { left: 0, right: 0, top: 16, bottom: 0, outerBoundsMode: "none" },
            yAxis: { type: "value", show: false, scale: true, boundaryGap: ["16%", "20%"] },
          }}
        >
          <EChartsAreaChart.Tooltip variant="frosted-glass" />
          <EChartsAreaChart.Area
            dataKey="equity"
            variant="gradient"
            strokeVariant="solid"
            strokeWidth={2.5}
          >
            <EChartsAreaChart.ActiveDot variant="ping" />
          </EChartsAreaChart.Area>
        </EChartsAreaChart>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1 pb-1 text-[10px] text-muted-foreground sm:px-2 sm:text-xs">
          <span>{chartData[1]?.date}</span>
          <span>{chartData[chartData.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
};

export const JournalAnalyticsTabs = ({
  trades,
  calculatorResults: _calculatorResults = [],
  isLoading,
  activeTab,
  onTabChange,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  startingBalance = 0,
  timeZone = null,
  serverStats = null,
  isStatsBackfilling = false,
  feedTrades,
  canLoadMoreTrades = false,
  isLoadingMoreTrades = false,
  onLoadMoreTrades,
  serverPerformance = null,
  requireServerAnalytics = false,
}: JournalAnalyticsTabsProps) => {
  void _calculatorResults;
  const { currency } = useCurrency();
  const [breakdownView, setBreakdownView] = useState<"instrument" | "session" | "strategy">("instrument");

  const localStats = useMemo(
    // Manual Trades analytics must not blend calculator history (DAN-011 / P-024).
    () => computeJournalStats(trades, [], startingBalance),
    [trades, startingBalance],
  );

  const stats = useMemo(() => {
    if (!serverStats) return localStats;

    const avgWin = serverStats.wins > 0 ? serverStats.winPnlSum / serverStats.wins : null;
    const avgLoss = serverStats.losses > 0 ? serverStats.lossAbsSum / serverStats.losses : null;
    let profitFactor: number | null = null;
    if (serverStats.closedWithPnl > 0) {
      profitFactor = serverStats.grossLoss > 0
        ? serverStats.grossProfit / serverStats.grossLoss
        : serverStats.grossProfit > 0
          ? Number.POSITIVE_INFINITY
          : null;
    }

    return {
      totalTrades: serverStats.totalTrades,
      closedTrades: serverStats.closedTrades,
      openTrades: serverStats.openTrades,
      wins: serverStats.wins,
      losses: serverStats.losses,
      breakeven: serverStats.breakeven,
      winRate: serverStats.closedWithPnl > 0
        ? (serverStats.wins / serverStats.closedWithPnl) * 100
        : 0,
      totalPnl: serverStats.totalPnl,
      grossProfit: serverStats.grossProfit,
      grossLoss: serverStats.grossLoss,
      profitFactor,
      avgWin,
      avgLoss,
      avgWinLossRatio: avgWin !== null && avgLoss !== null && avgLoss > 0 ? avgWin / avgLoss : null,
      bestTrade: serverStats.orderedMetricsStale ? null : serverStats.bestTrade,
      worstTrade: serverStats.orderedMetricsStale ? null : serverStats.worstTrade,
      avgR: serverStats.rCount > 0 ? serverStats.rSum / serverStats.rCount : null,
      expectancy: serverStats.closedWithPnl > 0
        ? serverStats.totalPnl / serverStats.closedWithPnl
        : null,
      maxDrawdown: serverStats.orderedMetricsStale ? null : serverStats.maxDrawdown,
      maxConsecutiveWins: serverStats.orderedMetricsStale ? 0 : serverStats.maxConsecutiveWins,
      maxConsecutiveLosses: serverStats.orderedMetricsStale ? 0 : serverStats.maxConsecutiveLosses,
    };
  }, [localStats, serverStats]);
  const localDailyPnl = useMemo(() => computeDailyPnl(trades, timeZone), [trades, timeZone]);
  const localDayPerformance = useMemo(
    () => computeDayOfWeekPerformance(trades, timeZone),
    [trades, timeZone],
  );
  const localStrategyBreakdown = useMemo(() => computeStrategyBreakdown(trades), [trades]);
  const localSessionBreakdown = useMemo(() => computeSessionBreakdown(trades), [trades]);
  const localInstrumentBreakdown = useMemo(() => computeInstrumentBreakdown(trades), [trades]);

  const dailyPnl = serverPerformance?.dailyPnl ?? localDailyPnl;
  const dayPerformance = serverPerformance?.dayPerformance ?? localDayPerformance;
  const strategyBreakdown = (serverPerformance?.strategyBreakdown ?? localStrategyBreakdown) as PerformanceBreakdownRow[];
  const sessionBreakdown = (serverPerformance?.sessionBreakdown ?? localSessionBreakdown) as PerformanceBreakdownRow[];
  const instrumentBreakdown = (serverPerformance?.instrumentBreakdown ?? localInstrumentBreakdown) as PerformanceBreakdownRow[];
  const visibleTrades = useMemo(
    () => feedTrades ?? [...trades].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 8),
    [feedTrades, trades],
  );
  const closedManualWithPnl = useMemo(
    () =>
      trades.filter(
        (trade) =>
          trade.status === "closed" &&
          trade.pnl !== null &&
          trade.pnl !== undefined &&
          Number.isFinite(trade.pnl),
      ).length,
    [trades],
  );

  const pnlTone = stats.totalPnl > 0 ? "positive" : stats.totalPnl < 0 ? "negative" : "neutral";
  const currentEquity = startingBalance + stats.totalPnl;
  const outcomeCount = stats.wins + stats.losses + stats.breakeven;
  const activeWeekdays = dayPerformance.filter((day) => day.total > 0);
  const selectedBreakdown = breakdownView === "instrument"
    ? instrumentBreakdown
    : breakdownView === "session"
      ? sessionBreakdown
      : strategyBreakdown;
  const breakdownDescription = breakdownView === "instrument"
    ? "Results by traded pair or symbol"
    : breakdownView === "session"
      ? "Based on UTC trading sessions"
      : "Based on Tags / Setup on each trade";
  const breakdownEmptyHint = breakdownView === "instrument"
    ? "Close a trade with P&L to see instrument results."
    : breakdownView === "session"
      ? "Close trades with dates to see session results."
      : "Add Tags / Setup to your trades to see strategy results.";

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    );
  }

  if (requireServerAnalytics && !serverStats) {
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm text-muted-foreground">Preparing lifetime totals. Your trade history is available below.</p>
        <Button onClick={onAddTrade}>Add Trade</Button>
        {visibleTrades.map((trade) => (
          <TradeListItem key={trade.id} trade={trade} currencySymbol={currency.symbol}
            timeZone={timeZone} onEdit={() => onEditTrade(trade)} onDelete={() => onDeleteTrade(trade)} />
        ))}
        {canLoadMoreTrades && onLoadMoreTrades ? (
          <Button onClick={onLoadMoreTrades} disabled={isLoadingMoreTrades}>
            {isLoadingMoreTrades ? "Loading…" : "Load older trades"}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Trades</h2>
          <p className="text-sm text-muted-foreground">
            {serverStats ? serverStats.closedWithPnl : closedManualWithPnl} closed with P&amp;L
            {stats.openTrades > 0 ? ` · ${stats.openTrades} open` : ""}
            {stats.totalTrades !== (serverStats ? serverStats.closedWithPnl : closedManualWithPnl)
              ? ` · ${stats.totalTrades} total`
              : ""}
            {isStatsBackfilling ? " · updating lifetime stats" : ""}
          </p>
        </div>
        <Button size="sm" onClick={onAddTrade}>
          <Plus className="mr-2 h-4 w-4" />
          Add Trade
        </Button>
      </div>

      {serverPerformance?.truncated ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Detailed performance views are capped at 20,000 closed trades. Lifetime headline totals remain complete.
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as JournalTab)}>
        <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-secondary p-1">
          <TabsTrigger value="overview" className="rounded-xl py-2.5 text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="insights" className="rounded-xl py-2.5 text-xs sm:text-sm">
            Insights
          </TabsTrigger>
          <TabsTrigger value="charts" className="rounded-xl py-2.5 text-xs sm:text-sm">
            Charts
          </TabsTrigger>
        </TabsList>

        {stats.totalTrades === 0 ? (
          <div className="mt-4">
            <EmptyState onAddTrade={onAddTrade} />
          </div>
        ) : requireServerAnalytics && activeTab !== "overview" && !serverPerformance?.ready ? (
          <p role="status" className="py-6 text-sm text-muted-foreground">Preparing complete performance history…</p>
        ) : (
          <>
            <TabsContent value="overview" className="mt-4 space-y-4">
              <section className="rounded-2xl bg-secondary p-3 sm:p-4">
                <div className="mb-3">
                  <h3 className="text-base font-bold text-foreground">Account Overview</h3>
                  <p className="text-xs text-muted-foreground">
                    {startingBalance > 0
                      ? `Starting ${formatJournalMoney(startingBalance, currency.symbol)} · Equity ${formatJournalMoney(currentEquity, currency.symbol)}`
                      : "Portfolio status from logged trades"}
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="Net P&L"
                    value={formatJournalMoney(stats.totalPnl, currency.symbol)}
                    hint={`${stats.closedTrades} closed trade${stats.closedTrades === 1 ? "" : "s"}`}
                    tone={pnlTone}
                  />
                  <MetricCard
                    label="Gross Profit"
                    value={formatJournalMoney(stats.grossProfit, currency.symbol)}
                    hint="Before losses"
                    tone="positive"
                  />
                  <MetricCard
                    label="Gross Loss"
                    value={formatJournalMoney(-stats.grossLoss, currency.symbol)}
                    hint="Total losing trades"
                    tone="negative"
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Net = Gross Profit − Gross Loss
                  {stats.openTrades > 0
                    ? ` · Open trades don’t affect P&L until closed with a result`
                    : ""}
                </p>
              </section>

              <section className="rounded-2xl bg-secondary p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Trading Edge</h3>
                    <p className="text-xs text-muted-foreground">Quick performance metrics</p>
                  </div>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Win Rate"
                    value={formatJournalPercent(stats.winRate)}
                    hint={`${stats.wins}W / ${stats.losses}L`}
                  />
                  <MetricCard
                    label="Expectancy"
                    value={formatJournalMoney(stats.expectancy, currency.symbol)}
                    hint="Avg P&L per closed trade"
                  />
                  <MetricCard
                    label="Max Drawdown"
                    value={formatJournalMoney(stats.maxDrawdown, currency.symbol)}
                    hint={startingBalance > 0 ? "Peak-to-trough from start" : "From trade P&L only"}
                    tone={stats.maxDrawdown != null && stats.maxDrawdown < 0 ? "negative" : "neutral"}
                  />
                  <MetricCard
                    label="Open Trades"
                    value={String(stats.openTrades)}
                    hint={`${stats.closedTrades} closed`}
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-2xl bg-secondary p-3 sm:p-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Trade History</h3>
                  <p className="text-xs text-muted-foreground">Newest first, loaded in pages</p>
                </div>
                <div className="space-y-2">
                  {visibleTrades.map((trade) => (
                    <TradeListItem
                      key={trade.id}
                      trade={trade}
                      currencySymbol={currency.symbol}
                      timeZone={timeZone}
                      onEdit={() => onEditTrade(trade)}
                      onDelete={() => onDeleteTrade(trade)}
                    />
                  ))}
                </div>
                {canLoadMoreTrades && onLoadMoreTrades ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3 w-full"
                    onClick={onLoadMoreTrades}
                    disabled={isLoadingMoreTrades}
                  >
                    {isLoadingMoreTrades ? "Loading…" : "Load older trades"}
                  </Button>
                ) : null}
              </section>
            </TabsContent>

            <TabsContent value="insights" className="mt-4 space-y-3">
              <section className="rounded-3xl border border-brand/20 bg-gradient-to-br from-brand/15 via-secondary to-secondary p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-brand">Performance</p>
                    <h3 className="mt-1 text-lg font-semibold text-foreground">At a glance</h3>
                  </div>
                  <span className="rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                    {outcomeCount} closed result{outcomeCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Net P&amp;L</p>
                    <p className={cn("mt-1 break-words text-xl font-semibold tracking-tight tabular-nums sm:text-3xl", pnlTone === "positive" ? "text-emerald-400" : pnlTone === "negative" ? "text-red-400" : "text-foreground")}>
                      {formatJournalMoney(stats.totalPnl, currency.symbol)}
                    </p>
                  </div>
                  <div className="min-w-0 border-l border-border/60 pl-4">
                    <p className="text-xs text-muted-foreground">Win rate</p>
                    <p className="mt-1 text-xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
                      {formatJournalPercent(stats.winRate)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-background/70" aria-label={`${stats.wins} wins, ${stats.losses} losses, ${stats.breakeven} breakeven`}>
                  {outcomeCount > 0 ? (
                    <>
                      <div className="bg-emerald-400" style={{ width: `${(stats.wins / outcomeCount) * 100}%` }} />
                      <div className="bg-red-400" style={{ width: `${(stats.losses / outcomeCount) * 100}%` }} />
                      <div className="bg-muted-foreground" style={{ width: `${(stats.breakeven / outcomeCount) * 100}%` }} />
                    </>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span><span className="text-emerald-400">●</span> {stats.wins} wins</span>
                  <span><span className="text-red-400">●</span> {stats.losses} losses</span>
                  <span><span className="text-muted-foreground">●</span> {stats.breakeven} breakeven</span>
                </div>
                <p className="mt-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  {stats.totalTrades} total trade{stats.totalTrades === 1 ? "" : "s"} · {stats.closedTrades} closed
                  {stats.openTrades > 0 ? ` · ${stats.openTrades} open` : ""}
                  {outcomeCount > 0 && outcomeCount < 10 ? " · Early results: a larger sample will be more useful." : ""}
                </p>
              </section>

              <section className="rounded-2xl bg-secondary p-4 sm:p-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Where results came from</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Compare your closed trades by category.</p>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-background/60 p-1" role="group" aria-label="Breakdown view">
                  {(["instrument", "session", "strategy"] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      aria-pressed={breakdownView === view}
                      onClick={() => setBreakdownView(view)}
                      className={cn(
                        "rounded-lg px-2 py-2 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm",
                        breakdownView === view ? "bg-secondary text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {view}
                    </button>
                  ))}
                </div>
                <p className="my-3 text-xs text-muted-foreground">{breakdownDescription}</p>
                <BreakdownSection key={breakdownView} rows={selectedBreakdown} currencySymbol={currency.symbol} emptyHint={breakdownEmptyHint} />
                {breakdownView === "strategy" && strategyBreakdown.length > 0 && strategyBreakdown.every((row) => row.key === "untagged") ? (
                  <p className="mt-3 text-xs text-muted-foreground">Add Tags / Setup to trades to compare your strategies.</p>
                ) : null}
              </section>

              <section className="rounded-2xl bg-secondary p-4 sm:p-5">
                <div>
                  <h3 className="text-base font-semibold text-foreground">When results happened</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Only days with closed trade results are shown.</p>
                </div>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">By weekday</h4>
                    <div className="space-y-2">
                      {activeWeekdays.length === 0 ? (
                        <p className="rounded-xl bg-background/70 px-4 py-5 text-sm text-muted-foreground">No closed results yet.</p>
                      ) : activeWeekdays.map((day) => (
                        <div key={day.day} className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{day.day}</p>
                            <p className="text-xs text-muted-foreground">{day.total} trade{day.total === 1 ? "" : "s"} · {formatJournalPercent(day.winRate)} wins</p>
                          </div>
                          <p className={cn("text-sm font-semibold tabular-nums", day.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {formatJournalMoney(day.pnl, currency.symbol)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent days</h4>
                    <div className="space-y-2">
                      {dailyPnl.length === 0 ? (
                        <p className="rounded-xl bg-background/70 px-4 py-5 text-sm text-muted-foreground">No closed results yet.</p>
                      ) : [...dailyPnl].reverse().slice(0, 10).map((day) => (
                        <div key={day.dateKey} className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{formatInsightDate(day.dateKey)}</p>
                            <p className="text-xs text-muted-foreground">{day.trades} trade{day.trades === 1 ? "" : "s"}</p>
                          </div>
                          <p className={cn("text-sm font-semibold tabular-nums", day.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                            {formatJournalMoney(day.pnl, currency.symbol)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <details className="group rounded-2xl bg-secondary p-4 sm:p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Detailed metrics</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">Averages, extremes, and streaks</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-4 grid gap-5 border-t border-border/50 pt-2 sm:grid-cols-2">
                  <div>
                    <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trade quality</h4>
                    <InsightRow label="Average win" value={formatJournalMoney(stats.avgWin, currency.symbol)} tone={stats.avgWin !== null ? "positive" : "neutral"} />
                    <InsightRow label="Average loss" value={formatJournalMoney(stats.avgLoss === null ? null : -stats.avgLoss, currency.symbol)} tone={stats.avgLoss !== null ? "negative" : "neutral"} />
                    <InsightRow label="Win/loss ratio" value={stats.avgWinLossRatio === null ? "—" : `${stats.avgWinLossRatio.toFixed(2)}×`} />
                    <InsightRow label="Profit factor" value={formatProfitFactor(stats.profitFactor)} hint={stats.profitFactor === Number.POSITIVE_INFINITY ? "No losing trades" : undefined} />
                    <InsightRow label="Average R" value={formatJournalR(stats.avgR)} hint={stats.avgR === null ? "Add risk amounts to trades to calculate this." : "Mean risk multiple"} />
                  </div>
                  <div>
                    <h4 className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Highs and lows</h4>
                    <InsightRow label="Best trade" value={formatJournalMoney(stats.bestTrade, currency.symbol)} tone={stats.bestTrade !== null && stats.bestTrade > 0 ? "positive" : "neutral"} />
                    <InsightRow label="Worst trade" value={formatJournalMoney(stats.worstTrade, currency.symbol)} tone={stats.worstTrade !== null && stats.worstTrade < 0 ? "negative" : stats.worstTrade !== null && stats.worstTrade > 0 ? "positive" : "neutral"} />
                    <InsightRow label="Best win streak" value={stats.maxConsecutiveWins ? `${stats.maxConsecutiveWins}W` : "—"} />
                    <InsightRow label="Longest loss streak" value={stats.maxConsecutiveLosses ? `${stats.maxConsecutiveLosses}L` : "—"} />
                  </div>
                </div>
              </details>
            </TabsContent>

            <TabsContent value="charts" className="mt-4 space-y-4">
              <section className="overflow-hidden rounded-2xl bg-secondary p-3 sm:p-4">
                <CumulativePnlAreaChart
                  trades={trades}
                  calculatorResults={[]}
                  currencySymbol={currency.symbol}
                  startingBalance={startingBalance}
                  timeZone={timeZone}
                  equityPointsOverride={serverPerformance?.equityCurve ?? null}
                />
              </section>

              <section className="rounded-2xl bg-secondary p-3 sm:p-4">
                <div className="mb-3">
                  <h3 className="text-base font-bold text-foreground">Wins vs Losses</h3>
                  <p className="text-xs text-muted-foreground">Distribution of closed trade outcomes</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <MetricCard label="Wins" value={String(stats.wins)} tone="positive" />
                  <MetricCard label="Losses" value={String(stats.losses)} tone="negative" />
                  <MetricCard label="Breakeven" value={String(stats.breakeven)} />
                </div>
              </section>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export type { JournalTab };
