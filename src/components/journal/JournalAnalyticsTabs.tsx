import { useMemo } from "react";
import {
  BarChart3,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
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
import type { JournalTrade } from "@/lib/convexJournal";
import {
  computeDailyPnl,
  computeDayOfWeekPerformance,
  computeEquityCurve,
  computeJournalStats,
  formatJournalMoney,
  formatJournalPercent,
} from "@/lib/journalAnalytics";
import { cn } from "@/lib/utils";

type JournalTab = "overview" | "statistics" | "performance" | "charts";

interface JournalAnalyticsTabsProps {
  trades: JournalTrade[];
  isLoading: boolean;
  activeTab: JournalTab;
  onTabChange: (tab: JournalTab) => void;
  onAddTrade: () => void;
  onEditTrade: (trade: JournalTrade) => void;
  onDeleteTrade: (trade: JournalTrade) => void;
  startingBalance?: number;
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
      Add manual trades to unlock overview metrics, statistics, performance breakdowns, and charts.
    </p>
    <Button className="mt-4" onClick={onAddTrade}>
      <Plus className="mr-2 h-4 w-4" />
      Add Manual Trade
    </Button>
  </div>
);

const TradeListItem = ({
  trade,
  currencySymbol,
  onEdit,
  onDelete,
}: {
  trade: JournalTrade;
  currencySymbol: string;
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
            {tradeDate.toLocaleDateString("en-US", {
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
  currencySymbol,
  startingBalance = 0,
}: {
  trades: JournalTrade[];
  currencySymbol: string;
  startingBalance?: number;
}) => {
  const equityPoints = useMemo(
    () => computeEquityCurve(trades, [], startingBalance),
    [trades, startingBalance],
  );

  const chartData = useMemo(
    () =>
      equityPoints.map((point, index) => ({
        date: index === 0 ? "Start" : point.label,
        equity: Number(point.value.toFixed(2)),
      })),
    [equityPoints],
  );

  const lastValue = equityPoints[equityPoints.length - 1]?.value ?? startingBalance;
  const closedCount = Math.max(equityPoints.length - 1, 0);
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
            Cumulative P&amp;L
          </span>
          <span className="max-w-[28ch] text-xs leading-snug text-muted-foreground">
            Equity curve from {closedCount} closed trade{closedCount === 1 ? "" : "s"}
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
  isLoading,
  activeTab,
  onTabChange,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  startingBalance = 0,
}: JournalAnalyticsTabsProps) => {
  const { currency } = useCurrency();

  const stats = useMemo(() => computeJournalStats(trades), [trades]);
  const dailyPnl = useMemo(() => computeDailyPnl(trades), [trades]);
  const dayPerformance = useMemo(() => computeDayOfWeekPerformance(trades), [trades]);
  const recentTrades = useMemo(
    () => [...trades].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, 8),
    [trades],
  );

  const pnlTone = stats.totalPnl > 0 ? "positive" : stats.totalPnl < 0 ? "negative" : "neutral";
  const currentEquity = startingBalance + stats.totalPnl;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-36 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Manual Trades</h2>
          <p className="text-sm text-muted-foreground">
            {trades.length} trade{trades.length === 1 ? "" : "s"} logged
          </p>
        </div>
        <Button size="sm" onClick={onAddTrade}>
          <Plus className="mr-2 h-4 w-4" />
          Add Trade
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as JournalTab)}>
        <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl bg-secondary p-1">
          <TabsTrigger value="overview" className="rounded-xl py-2.5 text-xs sm:text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="statistics" className="rounded-xl py-2.5 text-xs sm:text-sm">
            Stats
          </TabsTrigger>
          <TabsTrigger value="performance" className="rounded-xl py-2.5 text-xs sm:text-sm">
            Perf
          </TabsTrigger>
          <TabsTrigger value="charts" className="rounded-xl py-2.5 text-xs sm:text-sm">
            Charts
          </TabsTrigger>
        </TabsList>

        {trades.length === 0 ? (
          <div className="mt-4">
            <EmptyState onAddTrade={onAddTrade} />
          </div>
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
                    label="Open Trades"
                    value={String(stats.openTrades)}
                    hint={`${stats.totalTrades} total`}
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-2xl bg-secondary p-3 sm:p-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Recent Trades</h3>
                  <p className="text-xs text-muted-foreground">Latest manual journal entries</p>
                </div>
                <div className="space-y-2">
                  {recentTrades.map((trade) => (
                    <TradeListItem
                      key={trade.id}
                      trade={trade}
                      currencySymbol={currency.symbol}
                      onEdit={() => onEditTrade(trade)}
                      onDelete={() => onDeleteTrade(trade)}
                    />
                  ))}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="statistics" className="mt-4 space-y-4">
              <section className="rounded-2xl bg-secondary p-3 sm:p-4">
                <div className="mb-3">
                  <h3 className="text-base font-bold text-foreground">Trade Statistics</h3>
                  <p className="text-xs text-muted-foreground">Win/loss breakdown and averages</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <MetricCard label="Total Trades" value={String(stats.totalTrades)} />
                  <MetricCard label="Closed" value={String(stats.closedTrades)} />
                  <MetricCard label="Win Rate" value={formatJournalPercent(stats.winRate)} />
                  <MetricCard label="Wins" value={String(stats.wins)} tone="positive" />
                  <MetricCard label="Losses" value={String(stats.losses)} tone="negative" />
                  <MetricCard label="Breakeven" value={String(stats.breakeven)} />
                  <MetricCard
                    label="Avg Win"
                    value={formatJournalMoney(stats.avgWin, currency.symbol)}
                    tone="positive"
                  />
                  <MetricCard
                    label="Avg Loss"
                    value={formatJournalMoney(stats.avgLoss ? -stats.avgLoss : null, currency.symbol)}
                    tone="negative"
                  />
                  <MetricCard
                    label="Win/Loss Ratio"
                    value={
                      stats.avgWinLossRatio !== null ? stats.avgWinLossRatio.toFixed(2) : "—"
                    }
                  />
                </div>
              </section>

              <section className="rounded-2xl bg-secondary p-3 sm:p-4">
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">Extremes</h3>
                    <p className="text-xs text-muted-foreground">Best and worst closed trades</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Best Trade"
                    value={formatJournalMoney(stats.bestTrade, currency.symbol)}
                    tone="positive"
                  />
                  <MetricCard
                    label="Worst Trade"
                    value={formatJournalMoney(stats.worstTrade, currency.symbol)}
                    tone="negative"
                  />
                  <MetricCard
                    label="Profit Factor"
                    value={stats.profitFactor !== null ? stats.profitFactor.toFixed(2) : "—"}
                  />
                  <MetricCard
                    label="Total P&L"
                    value={formatJournalMoney(stats.totalPnl, currency.symbol)}
                    tone={pnlTone}
                  />
                </div>
              </section>
            </TabsContent>

            <TabsContent value="performance" className="mt-4 space-y-4">
              <section className="rounded-2xl bg-secondary p-3 sm:p-4">
                <div className="mb-3">
                  <h3 className="text-base font-bold text-foreground">Daily Performance</h3>
                  <p className="text-xs text-muted-foreground">Win rate by day of week</p>
                </div>
                <div className="space-y-2">
                  {dayPerformance.map((day) => (
                    <div key={day.day} className="rounded-2xl bg-background p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{day.day}</p>
                        <p className="text-sm font-bold text-foreground">
                          {day.total ? formatJournalPercent(day.winRate) : "—"}
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${day.total ? day.winRate : 0}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{day.wins}W / {day.losses}L</span>
                        <span>{formatJournalMoney(day.pnl, currency.symbol)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl bg-secondary p-3 sm:p-4">
                <div className="mb-3">
                  <h3 className="text-base font-bold text-foreground">Daily Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Closed-trade results by date</p>
                </div>
                <div className="space-y-2">
                  {dailyPnl.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      Close trades with P&amp;L to populate daily performance.
                    </p>
                  ) : (
                    [...dailyPnl].reverse().slice(0, 10).map((day) => (
                      <div key={day.dateKey} className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{day.label}</p>
                          <p className="text-xs text-muted-foreground">{day.trades} trade{day.trades === 1 ? "" : "s"}</p>
                        </div>
                        <p className={`text-sm font-bold ${day.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatJournalMoney(day.pnl, currency.symbol)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="charts" className="mt-4 space-y-4">
              <section className="overflow-hidden rounded-2xl bg-secondary p-3 sm:p-4">
                <CumulativePnlAreaChart
                  trades={trades}
                  currencySymbol={currency.symbol}
                  startingBalance={startingBalance}
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
