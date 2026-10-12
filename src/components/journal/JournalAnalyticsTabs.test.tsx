import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { JournalAnalyticsTabs } from "./JournalAnalyticsTabs";
import type { JournalTradeStatsSnapshot } from "@/hooks/queries/use-journal-trade-stats";

vi.mock("@/contexts/CurrencyContext", () => ({ useCurrency: () => ({ currency: { symbol: "$" } }) }));
vi.mock("@/components/evilcharts/charts/echarts-area-chart", () => ({ EChartsAreaChart: () => null }));

const stats: JournalTradeStatsSnapshot = {
  sourceVersion: 1, totalTrades: 10000, openTrades: 0, closedTrades: 10000,
  cancelledTrades: 0, closedWithPnl: 10000, wins: 5000, losses: 5000, breakeven: 0,
  totalPnl: 1000, grossProfit: 6000, grossLoss: 5000, winPnlSum: 6000, lossAbsSum: 5000,
  bestTrade: 2, worstTrade: -1, rCount: 0, rSum: 0, maxConsecutiveWins: 1,
  maxConsecutiveLosses: 1, maxDrawdown: -1, processedTrades: 10000, updatedAtMs: 1,
};
const props = {
  trades: [], feedTrades: [], isLoading: false, activeTab: "overview" as const,
  onTabChange: vi.fn(), onAddTrade: vi.fn(), onEditTrade: vi.fn(), onDeleteTrade: vi.fn(),
  requireServerAnalytics: true, canLoadMoreTrades: true, onLoadMoreTrades: vi.fn(),
};

describe("paginated journal analytics", () => {
  it("does not present empty or partial feed totals while lifetime totals are unavailable", () => {
    render(<JournalAnalyticsTabs {...props} serverStats={null} />);
    expect(screen.queryByText("No trades logged yet")).not.toBeInTheDocument();
    expect(screen.queryByText("Net P&L")).not.toBeInTheDocument();
  });

  it("uses lifetime totals even when the loaded page contains only notebook drafts", () => {
    render(<JournalAnalyticsTabs {...props} serverStats={stats} />);
    expect(screen.getByText(/10000 closed with/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load older trades" })).toBeInTheDocument();
    expect(screen.queryByText("No trades logged yet")).not.toBeInTheDocument();
  });

  it("waits for complete performance data instead of deriving insights from a page", () => {
    render(<JournalAnalyticsTabs {...props} activeTab="insights" serverStats={stats} />);
    expect(screen.getByRole("status")).toHaveTextContent("Preparing complete performance history");
    expect(screen.queryByText("By Strategy")).not.toBeInTheDocument();
  });

  it("shows the empty state only when the complete summary is empty", () => {
    render(<JournalAnalyticsTabs {...props} serverStats={{ ...stats, totalTrades: 0 }} />);
    expect(screen.getByText("No trades logged yet")).toBeInTheDocument();
  });
});
