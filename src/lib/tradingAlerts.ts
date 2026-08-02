/**
 * Pure helpers for trading risk / milestone alerts (P-030 / DAN-013).
 * Used by client toasts and Convex queue evaluation.
 */

export const TRADE_COUNT_MILESTONES = [10, 25, 50, 100] as const;
export const EQUITY_PCT_MILESTONES = [5, 10, 25, 50] as const;

/** Mirrors convex/lib/tradingAlerts.ts — documented scan cap for milestone eval. */
export const CLOSED_TRADE_ALERT_SCAN_LIMIT = 2000;

export type RiskAlert = {
  kind: "risk";
  riskPercent: number;
  defaultRiskPercent: number;
  title: string;
  body: string;
};

export type MilestoneAlert = {
  kind: "milestone";
  milestoneKey: string;
  title: string;
  body: string;
};

export type TradingAlert = RiskAlert | MilestoneAlert;

export const evaluateRiskAlert = (
  riskPercent: number | null | undefined,
  defaultRiskPercent: number,
): RiskAlert | null => {
  if (riskPercent == null || !Number.isFinite(riskPercent)) return null;
  if (!Number.isFinite(defaultRiskPercent) || defaultRiskPercent <= 0) return null;
  if (riskPercent <= defaultRiskPercent) return null;

  return {
    kind: "risk",
    riskPercent,
    defaultRiskPercent,
    title: "Risk warning",
    body: `This trade risks ${riskPercent.toFixed(2)}%, above your ${defaultRiskPercent.toFixed(2)}% default.`,
  };
};

export const evaluateTradeCountMilestone = (
  closedTradeCount: number,
): MilestoneAlert | null => {
  if (!TRADE_COUNT_MILESTONES.includes(closedTradeCount as (typeof TRADE_COUNT_MILESTONES)[number])) {
    return null;
  }

  return {
    kind: "milestone",
    milestoneKey: `trades-${closedTradeCount}`,
    title: "Trade milestone",
    body: `You logged ${closedTradeCount} closed trades. Keep journaling your edge.`,
  };
};

/**
 * Fires when equity % crosses a threshold that previous equity was still below.
 * equityPct = ((startingBalance + totalPnl) / startingBalance - 1) * 100
 */
export const evaluateEquityMilestone = (
  startingBalance: number,
  previousTotalPnl: number,
  nextTotalPnl: number,
): MilestoneAlert | null => {
  if (!Number.isFinite(startingBalance) || startingBalance <= 0) return null;
  if (!Number.isFinite(previousTotalPnl) || !Number.isFinite(nextTotalPnl)) return null;

  const previousPct = (previousTotalPnl / startingBalance) * 100;
  const nextPct = (nextTotalPnl / startingBalance) * 100;

  for (const threshold of EQUITY_PCT_MILESTONES) {
    if (previousPct < threshold && nextPct >= threshold) {
      return {
        kind: "milestone",
        milestoneKey: `equity-${threshold}`,
        title: "Account milestone",
        body: `Account equity is up ${nextPct.toFixed(1)}% from starting balance (≥${threshold}%).`,
      };
    }
  }

  return null;
};

export const parseDefaultRiskPercent = (raw: string | null | undefined, fallback = 1): number => {
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
