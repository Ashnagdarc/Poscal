import { useMemo } from "react";
import {
  EChartsAreaChart,
  type ChartConfig,
} from "@/components/evilcharts/charts/echarts-area-chart";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { JournalEntry } from "@/lib/calculatorHistory";
import type { JournalTrade } from "@/lib/convexJournal";
import {
  computeEquityCurve,
  formatJournalMoney,
} from "@/lib/journalAnalytics";
import { cn } from "@/lib/utils";

interface TradingGrowthChartProps {
  trades: JournalTrade[];
  calculatorResults?: JournalEntry[];
  startingBalance?: number;
}

const chartConfig = {
  equity: {
    label: "Equity",
    colors: {
      light: ["#047857"],
      dark: ["#10b981"],
    },
  },
} satisfies ChartConfig;

export const TradingGrowthChart = ({
  trades,
  calculatorResults = [],
  startingBalance = 0,
}: TradingGrowthChartProps) => {
  const { currency } = useCurrency();

  const equityPoints = useMemo(
    () => computeEquityCurve(trades, calculatorResults, startingBalance),
    [trades, calculatorResults, startingBalance],
  );

  const chartData = useMemo(
    () =>
      equityPoints.map((point, index) => ({
        label: index === 0 ? "Start" : point.label,
        equity: Number(point.value.toFixed(2)),
        tradePnl: point.tradePnl,
        pair: point.pair,
        dateKey: point.dateKey,
      })),
    [equityPoints],
  );

  const lastValue = equityPoints[equityPoints.length - 1]?.value ?? startingBalance;
  const netGrowth = lastValue - startingBalance;
  const firstTradeLabel = equityPoints.length > 1 ? equityPoints[1]?.label : undefined;
  const lastLabel = equityPoints[equityPoints.length - 1]?.label;
  const closedTrades = Math.max(equityPoints.length - 1, 0);
  const isPositive = netGrowth > 0;
  const isNegative = netGrowth < 0;

  const yDomain = useMemo(() => {
    if (chartData.length < 2) return null;
    const values = chartData.map((point) => point.equity);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const span = Math.max(dataMax - dataMin, 1);
    // Pad enough that a typical loss step is readable on the axis.
    const pad = Math.max(span * 0.2, 75);
    return {
      min: Math.floor(dataMin - pad),
      max: Math.ceil(dataMax + pad),
    };
  }, [chartData]);

  if (chartData.length < 2) {
    return (
      <section className="rounded-2xl bg-secondary p-3 sm:p-4">
        <div className="mb-3">
          <h3 className="text-base font-bold text-foreground">Trading Growth</h3>
          <p className="text-xs text-muted-foreground">
            Starts from your journal account size
          </p>
        </div>
        <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border bg-background/40 px-4 text-center text-sm text-muted-foreground">
          Close a few trades to see your equity curve
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-secondary p-3 sm:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground">Trading Growth</h3>
          <p className="text-xs text-muted-foreground">
            {closedTrades} closed result{closedTrades === 1 ? "" : "s"}
            {firstTradeLabel && lastLabel ? ` · ${firstTradeLabel} – ${lastLabel}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Equity</p>
          <p className="text-lg font-bold tabular-nums text-foreground">
            {formatJournalMoney(lastValue, currency.symbol)}
          </p>
          <p
            className={cn(
              "text-xs font-semibold tabular-nums",
              isPositive && "text-emerald-400",
              isNegative && "text-red-400",
              !isPositive && !isNegative && "text-muted-foreground",
            )}
          >
            {formatJournalMoney(netGrowth, currency.symbol)} net
          </p>
        </div>
      </div>

      <div className="h-56 w-full sm:h-64">
        <EChartsAreaChart
          data={chartData}
          config={chartConfig}
          className="h-full w-full"
          xDataKey="label"
          curveType="linear"
          stackType="default"
          animationType="left-to-right"
        >
          <EChartsAreaChart.Grid />
          <EChartsAreaChart.XAxis
            dataKey="label"
            tickFormatter={(value) => (value === "Start" ? "Start" : value)}
          />
          <EChartsAreaChart.YAxis
            scale
            min={yDomain?.min}
            max={yDomain?.max}
            tickFormatter={(value) =>
              `${value >= 0 ? "" : "-"}${currency.symbol}${Math.abs(value).toFixed(0)}`
            }
          />
          <EChartsAreaChart.Tooltip />
          <EChartsAreaChart.Area
            dataKey="equity"
            variant="gradient"
            strokeVariant="solid"
            strokeWidth={2}
            curveType="linear"
          >
            <EChartsAreaChart.Dot variant="border" />
            <EChartsAreaChart.ActiveDot variant="colored-border" />
          </EChartsAreaChart.Area>
        </EChartsAreaChart>
      </div>
    </section>
  );
};
