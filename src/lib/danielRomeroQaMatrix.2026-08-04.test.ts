/**
 * Daniel Romero Trading QA — 50-case position-size matrix + analytics fixture
 * Date: 2026-08-04
 *
 * Independent expected values computed here (not copied from app output).
 * App results come from calculatePositionSize / computeJournalStats.
 */
import { describe, expect, it } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  calculatePositionSize,
  roundToLotStep,
  type CalculatePositionSizeInput,
} from "@/lib/positionSizeCalculator";
import { getInstrumentSpecBySymbol } from "@/lib/instrumentSpecs";
import {
  computeInstrumentBreakdown,
  computeJournalStats,
  computeSessionBreakdown,
  computeStrategyBreakdown,
  type JournalStats,
} from "@/lib/journalAnalytics";
import type { JournalTrade } from "@/lib/convexJournal";

// ---------------------------------------------------------------------------
// Independent position-size model (mirror of product contract, implemented
// separately for double-entry verification)
// ---------------------------------------------------------------------------

function independentPipValue(
  symbol: string,
  entry?: number | null,
  marketPrices?: Record<string, number> | null,
): number | null {
  const spec = getInstrumentSpecBySymbol(symbol);
  if (!spec) return null;

  const [base, quote] = symbol.includes("/")
    ? symbol.split("/")
    : [symbol, ""];

  // USD-base non-USD-quote: entry required
  if (base === "USD" && quote && quote !== "USD") {
    if (!entry || entry <= 0) return null;
    return (spec.contractSize * spec.pipSize) / entry;
  }

  // Crosses (neither side USD)
  if (base && quote && base !== "USD" && quote !== "USD") {
    const pipInQuote = spec.contractSize * spec.pipSize;
    const conversionPair =
      quote === "JPY" || quote === "CHF" || quote === "CAD"
        ? `USD/${quote}`
        : `${quote}/USD`;
    const rate = marketPrices?.[conversionPair];
    if (!rate || rate <= 0) return null;
    if (conversionPair.startsWith("USD/")) return pipInQuote / rate;
    return pipInQuote * rate;
  }

  return spec.pipValuePerStandardLot > 0 ? spec.pipValuePerStandardLot : null;
}

function independentSize(input: {
  symbol: string;
  accountBalance: number;
  riskPercent: number;
  stopLossPips: number;
  entryPrice?: number | null;
  marketPrices?: Record<string, number> | null;
}): { valid: boolean; lots: number | null; pipValue: number | null; reason?: string } {
  if (!(input.accountBalance > 0) || !(input.riskPercent > 0) || !(input.stopLossPips > 0)) {
    return { valid: false, lots: null, pipValue: null, reason: "invalid inputs" };
  }
  const spec = getInstrumentSpecBySymbol(input.symbol);
  if (!spec) {
    return { valid: false, lots: null, pipValue: null, reason: "unsupported" };
  }
  const pip = independentPipValue(input.symbol, input.entryPrice, input.marketPrices);
  if (pip == null || pip <= 0) {
    return { valid: false, lots: null, pipValue: pip, reason: "missing pip value inputs" };
  }
  const risk = (input.accountBalance * input.riskPercent) / 100;
  const raw = risk / (input.stopLossPips * pip);
  let lots = roundToLotStep(raw, spec.lotStep);
  if (lots > 0 && lots < spec.minLot) lots = spec.minLot;
  lots = Math.min(lots, spec.maxLot);
  return { valid: true, lots, pipValue: pip };
}

type MatrixCase = {
  id: number;
  label: string;
  input: CalculatePositionSizeInput;
  /** Product gap flag — pass still expected vs independent model */
  productNote?: string;
};

const MATRIX: MatrixCase[] = [
  // USD majors — risk ladder + balances
  { id: 1, label: "EUR/USD micro 1k/1%/20", input: { symbol: "EUR/USD", accountBalance: 1000, riskPercent: 1, stopLossPips: 20 } },
  { id: 2, label: "EUR/USD Myfxbook ref 10k/1%/25", input: { symbol: "EUR/USD", accountBalance: 10000, riskPercent: 1, stopLossPips: 25 } },
  { id: 3, label: "EUR/USD low risk 50k/0.25%/15", input: { symbol: "EUR/USD", accountBalance: 50000, riskPercent: 0.25, stopLossPips: 15 } },
  { id: 4, label: "EUR/USD high risk 100k/5%/50", input: { symbol: "EUR/USD", accountBalance: 100000, riskPercent: 5, stopLossPips: 50 } },
  { id: 5, label: "EUR/USD 2500/2%/10", input: { symbol: "EUR/USD", accountBalance: 2500, riskPercent: 2, stopLossPips: 10 } },
  { id: 6, label: "GBP/USD 2k/1%/50", input: { symbol: "GBP/USD", accountBalance: 2000, riskPercent: 1, stopLossPips: 50 } },
  { id: 7, label: "GBP/USD 10k/1.5%/30", input: { symbol: "GBP/USD", accountBalance: 10000, riskPercent: 1.5, stopLossPips: 30 } },
  { id: 8, label: "AUD/USD 5k/1%/40", input: { symbol: "AUD/USD", accountBalance: 5000, riskPercent: 1, stopLossPips: 40 } },
  { id: 9, label: "NZD/USD 7.5k/0.5%/25", input: { symbol: "NZD/USD", accountBalance: 7500, riskPercent: 0.5, stopLossPips: 25 } },
  // USD-base with entry
  { id: 10, label: "USD/JPY@162.753 10k/1%/20", input: { symbol: "USD/JPY", accountBalance: 10000, riskPercent: 1, stopLossPips: 20, entryPrice: 162.753 } },
  { id: 11, label: "USD/JPY no entry (must reject)", input: { symbol: "USD/JPY", accountBalance: 10000, riskPercent: 1, stopLossPips: 20 } },
  { id: 12, label: "USD/JPY@150 25k/2%/35", input: { symbol: "USD/JPY", accountBalance: 25000, riskPercent: 2, stopLossPips: 35, entryPrice: 150 } },
  { id: 13, label: "USD/CAD@1.355 10k/1%/25", input: { symbol: "USD/CAD", accountBalance: 10000, riskPercent: 1, stopLossPips: 25, entryPrice: 1.355 } },
  { id: 14, label: "USD/CAD no entry (must reject)", input: { symbol: "USD/CAD", accountBalance: 10000, riskPercent: 1, stopLossPips: 25 } },
  { id: 15, label: "USD/CHF@0.885 10k/1%/25", input: { symbol: "USD/CHF", accountBalance: 10000, riskPercent: 1, stopLossPips: 25, entryPrice: 0.885 } },
  // Metals / crypto / indices
  { id: 16, label: "XAU/USD 10k/1%/10pts", input: { symbol: "XAU/USD", accountBalance: 10000, riskPercent: 1, stopLossPips: 10 } },
  { id: 17, label: "XAU/USD 9651.28/0.5%/36", input: { symbol: "XAU/USD", accountBalance: 9651.28, riskPercent: 0.5, stopLossPips: 36 } },
  { id: 18, label: "XAG/USD 10k/1%/20", input: { symbol: "XAG/USD", accountBalance: 10000, riskPercent: 1, stopLossPips: 20 } },
  { id: 19, label: "BTC/USD 50k/1%/500", input: { symbol: "BTC/USD", accountBalance: 50000, riskPercent: 1, stopLossPips: 500 } },
  { id: 20, label: "ETH/USD 20k/2%/50", input: { symbol: "ETH/USD", accountBalance: 20000, riskPercent: 2, stopLossPips: 50 } },
  { id: 21, label: "US30 $1/pt model 10k/1%/50", input: { symbol: "US30", accountBalance: 10000, riskPercent: 1, stopLossPips: 50 }, productNote: "instrumentSpecs=$1/pt; forexCalculations aligned $1/pt (MC-029)" },
  { id: 22, label: "US100 15k/1%/40", input: { symbol: "US100", accountBalance: 15000, riskPercent: 1, stopLossPips: 40 } },
  { id: 23, label: "US500 8k/0.75%/25", input: { symbol: "US500", accountBalance: 8000, riskPercent: 0.75, stopLossPips: 25 } },
  // Tiny/large SL, clamps
  { id: 24, label: "EUR/USD tiny SL 1k/1%/1", input: { symbol: "EUR/USD", accountBalance: 1000, riskPercent: 1, stopLossPips: 1 } },
  { id: 25, label: "EUR/USD huge SL → floor 0", input: { symbol: "EUR/USD", accountBalance: 1000, riskPercent: 1, stopLossPips: 200 } },
  { id: 26, label: "EUR/USD large bal 100k/0.25%/5", input: { symbol: "EUR/USD", accountBalance: 100000, riskPercent: 0.25, stopLossPips: 5 } },
  { id: 27, label: "GBP/USD 1k/5%/10", input: { symbol: "GBP/USD", accountBalance: 1000, riskPercent: 5, stopLossPips: 10 } },
  { id: 28, label: "AUD/USD 3k/3%/60", input: { symbol: "AUD/USD", accountBalance: 3000, riskPercent: 3, stopLossPips: 60 } },
  // Invalid inputs
  { id: 29, label: "zero balance", input: { symbol: "EUR/USD", accountBalance: 0, riskPercent: 1, stopLossPips: 20 } },
  { id: 30, label: "negative balance", input: { symbol: "EUR/USD", accountBalance: -1000, riskPercent: 1, stopLossPips: 20 } },
  { id: 31, label: "zero risk", input: { symbol: "EUR/USD", accountBalance: 1000, riskPercent: 0, stopLossPips: 20 } },
  { id: 32, label: "negative risk", input: { symbol: "EUR/USD", accountBalance: 1000, riskPercent: -1, stopLossPips: 20 } },
  { id: 33, label: "zero SL", input: { symbol: "EUR/USD", accountBalance: 1000, riskPercent: 1, stopLossPips: 0 } },
  { id: 34, label: "negative SL", input: { symbol: "EUR/USD", accountBalance: 1000, riskPercent: 1, stopLossPips: -20 } },
  // Crosses
  {
    id: 35,
    label: "EUR/GBP with GBPUSD 1.27",
    input: {
      symbol: "EUR/GBP",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
      marketPrices: { "GBP/USD": 1.27 },
    },
  },
  {
    id: 36,
    label: "EUR/JPY with USDJPY 150",
    input: {
      symbol: "EUR/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 30,
      entryPrice: 162.5,
      marketPrices: { "USD/JPY": 150 },
    },
  },
  {
    id: 37,
    label: "GBP/JPY with USDJPY 150",
    input: {
      symbol: "GBP/JPY",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 40,
      entryPrice: 200,
      marketPrices: { "USD/JPY": 150 },
    },
  },
  { id: 38, label: "unknown FOO/BAR", input: { symbol: "FOO/BAR", accountBalance: 10000, riskPercent: 1, stopLossPips: 20 } },
  { id: 39, label: "EUR/USD micro risk 500/0.5%/100", input: { symbol: "EUR/USD", accountBalance: 500, riskPercent: 0.5, stopLossPips: 100 } },
  { id: 40, label: "EUR/USD max lot clamp 100k/5%/5", input: { symbol: "EUR/USD", accountBalance: 100000, riskPercent: 5, stopLossPips: 5 } },
  { id: 41, label: "XAU 2.5k/2%/5", input: { symbol: "XAU/USD", accountBalance: 2500, riskPercent: 2, stopLossPips: 5 } },
  { id: 42, label: "USD/JPY@110 1k/1%/50", input: { symbol: "USD/JPY", accountBalance: 1000, riskPercent: 1, stopLossPips: 50, entryPrice: 110 } },
  { id: 43, label: "USD/JPY@160 1k/1%/50", input: { symbol: "USD/JPY", accountBalance: 1000, riskPercent: 1, stopLossPips: 50, entryPrice: 160 } },
  { id: 44, label: "NZD/USD 100k/1%/20", input: { symbol: "NZD/USD", accountBalance: 100000, riskPercent: 1, stopLossPips: 20 } },
  { id: 45, label: "GBP/USD 45k/0.25%/45", input: { symbol: "GBP/USD", accountBalance: 45000, riskPercent: 0.25, stopLossPips: 45 } },
  { id: 46, label: "EUR/USD with TP 10k/1%/20 TP40", input: { symbol: "EUR/USD", accountBalance: 10000, riskPercent: 1, stopLossPips: 20, takeProfitPips: 40 } },
  { id: 47, label: "XAU deep SL 50k/1%/100", input: { symbol: "XAU/USD", accountBalance: 50000, riskPercent: 1, stopLossPips: 100 } },
  { id: 48, label: "BTC 1k/5%/1000", input: { symbol: "BTC/USD", accountBalance: 1000, riskPercent: 5, stopLossPips: 1000 } },
  { id: 49, label: "US30 large 100k/2%/100", input: { symbol: "US30", accountBalance: 100000, riskPercent: 2, stopLossPips: 100 } },
  { id: 50, label: "EUR/USD fractional 12345.67/1.25%/33", input: { symbol: "EUR/USD", accountBalance: 12345.67, riskPercent: 1.25, stopLossPips: 33 } },
];

type MatrixRow = {
  id: number;
  label: string;
  inputs: string;
  appValid: boolean;
  appLots: number | null;
  appPip: number | null;
  appReason?: string;
  expectedValid: boolean;
  expectedLots: number | null;
  expectedPip: number | null;
  diffLots: number | null;
  status: "PASS" | "FAIL";
  notes: string;
};

function formatInputs(c: MatrixCase): string {
  const i = c.input;
  const parts = [
    `sym=${i.symbol}`,
    `bal=${i.accountBalance}`,
    `risk=${i.riskPercent}%`,
    `sl=${i.stopLossPips}`,
  ];
  if (i.entryPrice != null) parts.push(`entry=${i.entryPrice}`);
  if (i.takeProfitPips != null) parts.push(`tp=${i.takeProfitPips}`);
  if (i.marketPrices) parts.push(`fx=${JSON.stringify(i.marketPrices)}`);
  return parts.join(" | ");
}

function runMatrix(): MatrixRow[] {
  return MATRIX.map((c) => {
    const app = calculatePositionSize(c.input);
    const exp = independentSize({
      symbol: c.input.symbol,
      accountBalance: c.input.accountBalance ?? 0,
      riskPercent: c.input.riskPercent ?? 0,
      stopLossPips: c.input.stopLossPips ?? 0,
      entryPrice: c.input.entryPrice,
      marketPrices: c.input.marketPrices,
    });

    const appLots = app.isValid ? app.positionSize : null;
    const expLots = exp.valid ? exp.lots : null;
    const diff =
      appLots != null && expLots != null ? Number((appLots - expLots).toFixed(6)) : null;

    let status: "PASS" | "FAIL" = "PASS";
    let notes = c.productNote ?? "";

    if (app.isValid !== exp.valid) {
      status = "FAIL";
      notes = `validity mismatch app=${app.isValid} exp=${exp.valid}; ${notes}`.trim();
    } else if (app.isValid && exp.valid) {
      if (Math.abs((appLots ?? 0) - (expLots ?? 0)) > 1e-9) {
        status = "FAIL";
        notes = `lots mismatch; ${notes}`.trim();
      } else if (
        app.pipValue != null &&
        exp.pipValue != null &&
        Math.abs(app.pipValue - exp.pipValue) > 1e-6
      ) {
        status = "FAIL";
        notes = `pip mismatch app=${app.pipValue} exp=${exp.pipValue}; ${notes}`.trim();
      }
    }

    return {
      id: c.id,
      label: c.label,
      inputs: formatInputs(c),
      appValid: app.isValid,
      appLots,
      appPip: app.isValid ? app.pipValue : app.pipValue || null,
      appReason: app.reason,
      expectedValid: exp.valid,
      expectedLots: expLots,
      expectedPip: exp.pipValue,
      diffLots: diff,
      status,
      notes: notes || (app.isValid ? "Match" : `Rejected: ${app.reason ?? exp.reason}`),
    };
  });
}

// ---------------------------------------------------------------------------
// Analytics independent fixture (32 closed + open trades across 2 journals)
// ---------------------------------------------------------------------------

const trade = (
  overrides: Partial<JournalTrade> & Pick<JournalTrade, "id" | "pnl">,
): JournalTrade => ({
  pair: "EUR/USD",
  direction: "buy",
  entry_price: 1.1,
  exit_price: 1.105,
  stop_loss: null,
  take_profit: null,
  position_size: 0.5,
  risk_percent: 1,
  risk_amount: 100,
  status: "closed",
  notes: null,
  tags: null,
  entry_date: "2026-07-01T10:00:00.000Z",
  exit_date: "2026-07-01T14:00:00.000Z",
  created_at: "2026-07-01T10:00:00.000Z",
  ...overrides,
});

/** J1 — FTMO Eval 50k USD: 20 trades (19 closed + 1 open) */
const J1_TRADES: JournalTrade[] = [
  trade({ id: "j1-01", pnl: 250, pair: "EUR/USD", direction: "buy", tags: "Breakout", exit_date: "2026-07-01T10:00:00.000Z", risk_amount: 250 }),
  trade({ id: "j1-02", pnl: -200, pair: "EUR/USD", direction: "sell", tags: "Breakout", exit_date: "2026-07-02T11:00:00.000Z", risk_amount: 250 }),
  trade({ id: "j1-03", pnl: 180, pair: "GBP/USD", direction: "buy", tags: "Pullback", exit_date: "2026-07-03T12:00:00.000Z", risk_amount: 200 }),
  trade({ id: "j1-04", pnl: 0, pair: "GBP/USD", direction: "sell", tags: "Pullback", exit_date: "2026-07-03T16:00:00.000Z", risk_amount: 150 }), // BE
  trade({ id: "j1-05", pnl: 320, pair: "USD/JPY", direction: "buy", tags: "London Open", exit_date: "2026-07-04T09:00:00.000Z", risk_amount: 200 }),
  trade({ id: "j1-06", pnl: -150, pair: "AUD/USD", direction: "sell", tags: "Breakout", exit_date: "2026-07-07T14:00:00.000Z", risk_amount: 150 }),
  trade({ id: "j1-07", pnl: 90, pair: "XAU/USD", direction: "buy", tags: "News Fade", exit_date: "2026-07-08T15:00:00.000Z", risk_amount: 100 }),
  trade({ id: "j1-08", pnl: -175, pair: "EUR/USD", direction: "buy", tags: "Breakout", exit_date: "2026-07-09T08:00:00.000Z", risk_amount: 175 }),
  trade({ id: "j1-09", pnl: 210, pair: "NZD/USD", direction: "buy", tags: "Pullback", exit_date: "2026-07-10T18:00:00.000Z", risk_amount: 150 }),
  trade({ id: "j1-10", pnl: 140, pair: "BTC/USD", direction: "buy", tags: "Crypto Swing", exit_date: "2026-07-11T03:00:00.000Z", risk_amount: 100 }),
  trade({ id: "j1-11", pnl: -220, pair: "US30", direction: "sell", tags: "Index Scalp", exit_date: "2026-07-14T19:00:00.000Z", risk_amount: 200 }),
  trade({ id: "j1-12", pnl: 275, pair: "EUR/USD", direction: "sell", tags: "London Open", exit_date: "2026-07-15T10:00:00.000Z", risk_amount: 200 }),
  trade({ id: "j1-13", pnl: 0, pair: "GBP/USD", direction: "buy", tags: "News Fade", exit_date: "2026-07-16T13:00:00.000Z", risk_amount: 100 }), // BE
  trade({ id: "j1-14", pnl: 160, pair: "USD/CAD", direction: "buy", tags: "Pullback", exit_date: "2026-07-17T15:00:00.000Z", risk_amount: 120 }),
  trade({ id: "j1-15", pnl: -180, pair: "EUR/GBP", direction: "sell", tags: "Cross Trade", exit_date: "2026-07-18T09:00:00.000Z", risk_amount: 180 }),
  trade({ id: "j1-16", pnl: 300, pair: "XAU/USD", direction: "buy", tags: "Breakout", exit_date: "2026-07-21T11:00:00.000Z", risk_amount: 200 }),
  trade({ id: "j1-17", pnl: 120, pair: "EUR/USD", direction: "buy", tags: "Breakout", exit_date: "2026-07-22T10:00:00.000Z", risk_amount: 100 }),
  trade({ id: "j1-18", pnl: -240, pair: "GBP/JPY", direction: "sell", tags: "Cross Trade", exit_date: "2026-07-23T14:00:00.000Z", risk_amount: 200 }),
  trade({ id: "j1-19", pnl: 80, pair: "ETH/USD", direction: "buy", tags: "Crypto Swing", exit_date: "2026-07-24T20:00:00.000Z", risk_amount: 80 }),
  trade({ id: "j1-20", pnl: null, status: "open", pair: "EUR/USD", direction: "buy", tags: "Breakout", exit_date: null, entry_date: "2026-08-04T08:00:00.000Z" }),
];

/** J2 — Personal Live 10k GBP: 12 closed trades */
const J2_TRADES: JournalTrade[] = [
  trade({ id: "j2-01", pnl: 150, pair: "EUR/USD", direction: "buy", tags: "A+", exit_date: "2026-07-05T10:00:00.000Z", risk_amount: 100 }),
  trade({ id: "j2-02", pnl: -40, pair: "GBP/USD", direction: "sell", tags: "B", exit_date: "2026-07-06T11:00:00.000Z", risk_amount: 50 }),
  trade({ id: "j2-03", pnl: 80, pair: "XAU/USD", direction: "buy", tags: "A+", exit_date: "2026-07-08T09:00:00.000Z", risk_amount: 50 }),
  trade({ id: "j2-04", pnl: 120, pair: "EUR/USD", direction: "sell", tags: "A+", exit_date: "2026-07-09T14:00:00.000Z", risk_amount: 80 }),
  trade({ id: "j2-05", pnl: -60, pair: "USD/JPY", direction: "buy", tags: "C", exit_date: "2026-07-10T15:00:00.000Z", risk_amount: 60 }),
  trade({ id: "j2-06", pnl: 200, pair: "GBP/USD", direction: "buy", tags: "A+", exit_date: "2026-07-14T10:00:00.000Z", risk_amount: 100 }),
  trade({ id: "j2-07", pnl: 45, pair: "AUD/USD", direction: "buy", tags: "B", exit_date: "2026-07-15T12:00:00.000Z", risk_amount: 40 }),
  trade({ id: "j2-08", pnl: 0, pair: "EUR/USD", direction: "sell", tags: "B", exit_date: "2026-07-16T16:00:00.000Z", risk_amount: 50 }), // BE
  trade({ id: "j2-09", pnl: 90, pair: "NZD/USD", direction: "buy", tags: "A+", exit_date: "2026-07-21T11:00:00.000Z", risk_amount: 60 }),
  trade({ id: "j2-10", pnl: -20, pair: "XAU/USD", direction: "sell", tags: "C", exit_date: "2026-07-22T18:00:00.000Z", risk_amount: 40 }),
  trade({ id: "j2-11", pnl: 110, pair: "EUR/GBP", direction: "buy", tags: "A+", exit_date: "2026-07-23T09:00:00.000Z", risk_amount: 70 }),
  trade({ id: "j2-12", pnl: 40, pair: "BTC/USD", direction: "buy", tags: "Crypto", exit_date: "2026-07-28T03:00:00.000Z", risk_amount: 40 }),
];

/** Independent spreadsheet-style metrics (no app import) */
function independentStats(trades: JournalTrade[], startingBalance: number) {
  const closed = trades.filter((t) => t.status === "closed" && t.pnl != null && Number.isFinite(t.pnl));
  const pnls = closed.map((t) => t.pnl as number);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const be = pnls.filter((p) => p === 0);
  const totalPnl = pnls.reduce((s, p) => s + p, 0);
  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const sorted = [...closed].sort((a, b) => {
    const ta = new Date(a.exit_date ?? a.created_at).getTime();
    const tb = new Date(b.exit_date ?? b.created_at).getTime();
    return ta - tb || a.id.localeCompare(b.id);
  });
  let equity = startingBalance;
  let peak = startingBalance;
  let maxDd = 0;
  let wStreak = 0;
  let lStreak = 0;
  let maxW = 0;
  let maxL = 0;
  for (const t of sorted) {
    const p = t.pnl as number;
    equity += p;
    if (equity > peak) peak = equity;
    const dd = equity - peak;
    if (dd < maxDd) maxDd = dd;
    if (p > 0) {
      wStreak += 1;
      lStreak = 0;
      maxW = Math.max(maxW, wStreak);
    } else if (p < 0) {
      lStreak += 1;
      wStreak = 0;
      maxL = Math.max(maxL, lStreak);
    } else {
      wStreak = 0;
      lStreak = 0;
    }
  }
  const rMultiples = closed
    .filter((t) => t.risk_amount != null && Math.abs(t.risk_amount!) > 0)
    .map((t) => (t.pnl as number) / Math.abs(t.risk_amount!));
  const avgR = rMultiples.length
    ? rMultiples.reduce((s, r) => s + r, 0) / rMultiples.length
    : null;

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades: trades.filter((t) => t.status === "open").length,
    wins: wins.length,
    losses: losses.length,
    breakeven: be.length,
    winRate: pnls.length ? (wins.length / pnls.length) * 100 : 0,
    totalPnl,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : null,
    avgWin: wins.length ? grossProfit / wins.length : null,
    avgLoss: losses.length ? grossLoss / losses.length : null,
    expectancy: pnls.length ? totalPnl / pnls.length : null,
    maxDrawdown: pnls.length ? maxDd : null,
    maxConsecutiveWins: maxW,
    maxConsecutiveLosses: maxL,
    endingEquity: startingBalance + totalPnl,
    avgR,
  };
}

function compareStats(
  label: string,
  app: JournalStats,
  indep: ReturnType<typeof independentStats>,
): { metric: string; app: string; independent: string; match: boolean }[] {
  const rows: { metric: string; app: string; independent: string; match: boolean }[] = [];
  const check = (metric: string, a: number | null | undefined, b: number | null | undefined, tol = 1e-6) => {
    const bothNull = (a == null || !Number.isFinite(a as number)) && (b == null || !Number.isFinite(b as number));
    const bothInf = a === Infinity && b === Infinity;
    const close =
      typeof a === "number" && typeof b === "number" && Number.isFinite(a) && Number.isFinite(b)
        ? Math.abs(a - b) <= tol
        : false;
    rows.push({
      metric: `${label}: ${metric}`,
      app: String(a),
      independent: String(b),
      match: bothNull || bothInf || close,
    });
  };

  check("totalTrades", app.totalTrades, indep.totalTrades);
  check("closedTrades", app.closedTrades, indep.closedTrades);
  check("openTrades", app.openTrades, indep.openTrades);
  check("wins", app.wins, indep.wins);
  check("losses", app.losses, indep.losses);
  check("breakeven", app.breakeven, indep.breakeven);
  check("winRate", app.winRate, indep.winRate, 0.01);
  check("totalPnl", app.totalPnl, indep.totalPnl);
  check("grossProfit", app.grossProfit, indep.grossProfit);
  check("grossLoss", app.grossLoss, indep.grossLoss);
  check("profitFactor", app.profitFactor, indep.profitFactor, 0.001);
  check("avgWin", app.avgWin, indep.avgWin, 0.01);
  check("avgLoss", app.avgLoss, indep.avgLoss, 0.01);
  check("expectancy", app.expectancy, indep.expectancy, 0.01);
  check("maxDrawdown", app.maxDrawdown, indep.maxDrawdown, 0.01);
  check("maxConsecutiveWins", app.maxConsecutiveWins, indep.maxConsecutiveWins);
  check("maxConsecutiveLosses", app.maxConsecutiveLosses, indep.maxConsecutiveLosses);
  check("avgR", app.avgR, indep.avgR, 0.01);
  return rows;
}

describe("Daniel Romero QA 2026-08-04 — position size matrix (50)", () => {
  const rows = runMatrix();

  it("produces 50 cases", () => {
    expect(rows).toHaveLength(50);
  });

  it.each(MATRIX.map((c) => [c.id, c.label] as const))(
    "case #%s %s matches independent model",
    (id) => {
      const row = rows.find((r) => r.id === id)!;
      expect(row.status).toBe("PASS");
    },
  );

  it("writes machine-readable results for audit docs", () => {
    const outDir = resolve(process.cwd(), "docs/audit/data");
    mkdirSync(outDir, { recursive: true });
    const passCount = rows.filter((r) => r.status === "PASS").length;
    const payload = {
      generatedAt: "2026-08-04",
      tester: "Daniel Romero",
      passCount,
      failCount: rows.length - passCount,
      passRate: `${passCount}/${rows.length}`,
      rows,
    };
    writeFileSync(
      resolve(outDir, "DR_2026-08-04_calculator_matrix.json"),
      JSON.stringify(payload, null, 2),
    );
    const csvHeader =
      "id,label,inputs,appValid,appLots,appPip,expectedValid,expectedLots,expectedPip,diffLots,status,notes";
    const csvBody = rows
      .map((r) =>
        [
          r.id,
          JSON.stringify(r.label),
          JSON.stringify(r.inputs),
          r.appValid,
          r.appLots ?? "",
          r.appPip ?? "",
          r.expectedValid,
          r.expectedLots ?? "",
          r.expectedPip ?? "",
          r.diffLots ?? "",
          r.status,
          JSON.stringify(r.notes),
        ].join(","),
      )
      .join("\n");
    writeFileSync(resolve(outDir, "DR_2026-08-04_calculator_matrix.csv"), `${csvHeader}\n${csvBody}\n`);
    expect(passCount).toBe(50);
  });
});

describe("Daniel Romero QA 2026-08-04 — analytics accuracy", () => {
  it("J1 stats match independent spreadsheet", () => {
    const app = computeJournalStats(J1_TRADES, [], 50000);
    const indep = independentStats(J1_TRADES, 50000);
    const comparisons = compareStats("J1", app, indep);
    expect(comparisons.every((c) => c.match)).toBe(true);

    // Explicit known values from independent math
    expect(app.totalTrades).toBe(20);
    expect(app.closedTrades).toBe(19);
    expect(app.openTrades).toBe(1);
    expect(app.wins).toBe(11);
    expect(app.losses).toBe(6);
    expect(app.breakeven).toBe(2);
    expect(app.totalPnl).toBe(960);
    expect(app.grossProfit).toBe(2125);
    expect(app.grossLoss).toBe(1165);
    expect(app.profitFactor).toBeCloseTo(2125 / 1165, 5);
    expect(app.winRate).toBeCloseTo((11 / 19) * 100, 5);
    expect(app.expectancy).toBeCloseTo(960 / 19, 5);
  });

  it("J2 stats match independent spreadsheet", () => {
    const app = computeJournalStats(J2_TRADES, [], 10000);
    const indep = independentStats(J2_TRADES, 10000);
    const comparisons = compareStats("J2", app, indep);
    expect(comparisons.every((c) => c.match)).toBe(true);
    expect(app.totalTrades).toBe(12);
    expect(app.closedTrades).toBe(12);
    expect(app.wins).toBe(8);
    expect(app.losses).toBe(3);
    expect(app.breakeven).toBe(1);
    expect(app.totalPnl).toBe(715);
    expect(app.grossProfit).toBe(835);
    expect(app.grossLoss).toBe(120);
    expect(app.profitFactor).toBeCloseTo(835 / 120, 5);
  });

  it("journals stay isolated (no cross-mix of J1+J2)", () => {
    const j1 = computeJournalStats(J1_TRADES, [], 50000);
    const j2 = computeJournalStats(J2_TRADES, [], 10000);
    const merged = computeJournalStats([...J1_TRADES, ...J2_TRADES], [], 0);
    // Isolation = calling per-journal; if wrongly merged, totals would combine
    expect(j1.totalPnl + j2.totalPnl).toBe(merged.totalPnl);
    expect(j1.totalPnl).not.toBe(merged.totalPnl);
    expect(j2.totalPnl).not.toBe(merged.totalPnl);
  });

  it("strategy / instrument / session breakdowns sum to total P&L (J1 closed)", () => {
    const closed = J1_TRADES.filter((t) => t.status === "closed" && t.pnl != null);
    const total = closed.reduce((s, t) => s + (t.pnl as number), 0);
    const byStrategy = computeStrategyBreakdown(J1_TRADES);
    const byInstrument = computeInstrumentBreakdown(J1_TRADES);
    const bySession = computeSessionBreakdown(J1_TRADES);
    expect(byStrategy.reduce((s, r) => s + r.pnl, 0)).toBeCloseTo(total, 5);
    expect(byInstrument.reduce((s, r) => s + r.pnl, 0)).toBeCloseTo(total, 5);
    expect(bySession.reduce((s, r) => s + r.pnl, 0)).toBeCloseTo(total, 5);
  });

  it("writes analytics verification artifact", () => {
    const j1App = computeJournalStats(J1_TRADES, [], 50000);
    const j2App = computeJournalStats(J2_TRADES, [], 10000);
    const j1Ind = independentStats(J1_TRADES, 50000);
    const j2Ind = independentStats(J2_TRADES, 10000);
    const comparisons = [
      ...compareStats("J1", j1App, j1Ind),
      ...compareStats("J2", j2App, j2Ind),
    ];
    const outDir = resolve(process.cwd(), "docs/audit/data");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      resolve(outDir, "DR_2026-08-04_analytics_verification.json"),
      JSON.stringify(
        {
          generatedAt: "2026-08-04",
          tester: "Daniel Romero",
          j1: { app: j1App, independent: j1Ind },
          j2: { app: j2App, independent: j2Ind },
          comparisons,
          allMatch: comparisons.every((c) => c.match),
          tradeCounts: { j1: J1_TRADES.length, j2: J2_TRADES.length, total: J1_TRADES.length + J2_TRADES.length },
        },
        null,
        2,
      ),
    );
    expect(comparisons.every((c) => c.match)).toBe(true);
  });
});

describe("Daniel Romero QA 2026-08-04 — dual registry residual risk", () => {
  it("aligns US30 $1/pt between primary calc and legacy forexCalculations (MC-029)", async () => {
    const primary = calculatePositionSize({
      symbol: "US30",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 50,
    });
    // Primary registry: $1/point → 100/(50*1)=2.00 lots
    expect(primary.positionSize).toBe(2);
    expect(primary.pipValue).toBe(1);

    const { getPipValueInUSD } = await import("@/lib/forexCalculations");
    const legacyPip = getPipValueInUSD("US30");
    expect(legacyPip).toBe(1);
    const legacyLots = roundToLotStep(100 / (50 * legacyPip), 0.01);
    expect(legacyLots).toBe(2);
    expect(primary.positionSize).toBe(legacyLots);
  });

  it("converts account currency risk to USD for EURUSD lots (MC-003)", () => {
    // GBP account 10k risk 1% = £100; GBPUSD 1.27 → $127 risk
    // EURUSD pip=$10 → 127/(25*10)=0.508 → floor 0.50
    const result = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
      accountCurrency: "GBP",
      marketPrices: { "GBP/USD": 1.27 },
    });
    expect(result.isValid).toBe(true);
    expect(result.riskAmount).toBe(100);
    expect(result.riskAmountUsd).toBeCloseTo(127, 6);
    expect(result.positionSize).toBe(0.5);
  });

  it("blocks non-USD account sizing without FX rate", () => {
    const result = calculatePositionSize({
      symbol: "EUR/USD",
      accountBalance: 10000,
      riskPercent: 1,
      stopLossPips: 25,
      accountCurrency: "GBP",
    });
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/GBP\/USD/i);
  });
});
