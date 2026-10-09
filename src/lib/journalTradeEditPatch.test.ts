import { describe, expect, it } from "vitest";
import type { JournalTrade } from "@/lib/convexJournal";
import type { ManualTradeInput } from "@/hooks/queries/use-trades-query";
import { buildJournalTradeEditPatch } from "@/lib/journalTradeEditPatch";

const trade: JournalTrade = {
  id: "test-trade",
  pair: "GBP/USD",
  direction: "buy",
  entry_price: 1.322456,
  exit_price: 1.322401,
  stop_loss: 1.320111,
  take_profit: 1.325999,
  position_size: 0.25,
  risk_percent: 1,
  pnl: null,
  status: "closed",
  notes: "Original note",
  tags: "London breakout",
  market_condition: "London open",
  entry_date: "2026-10-09T08:37:42.123Z",
  exit_date: "2026-10-09T12:53:09.456Z",
  created_at: "2026-10-09T08:37:42.123Z",
  journal_type: "structured",
};

const form: ManualTradeInput = {
  pair: "GBP/USD",
  direction: "long",
  entry_price: 1.322456,
  exit_price: 1.322401,
  stop_loss: 1.320111,
  take_profit: 1.325999,
  position_size: 0.25,
  risk_percent: 1,
  pnl: null,
  status: "closed",
  notes: "Original note",
  tags: "London breakout",
  market_condition: null,
  entry_date: "2026-10-09T12:00:00.000Z",
  exit_date: "2026-10-09T12:00:00.000Z",
};

describe("historical journal Edit Trade patch", () => {
  it("does not rewrite a trade when reopened and saved unchanged", () => {
    expect(buildJournalTradeEditPatch(trade, form)).toEqual({});
  });

  it("only changes notes; leaves exact six-decimal prices, nullable P&L and execution timestamps untouched", () => {
    expect(buildJournalTradeEditPatch(trade, { ...form, notes: "New trading notes" })).toEqual({
      notes: "New trading notes",
    });
  });

  it("does not clear a recorded market condition when the form omits that field", () => {
    expect(buildJournalTradeEditPatch(trade, { ...form, market_condition: null })).toEqual({});
  });

  it("sends a genuine price or lot edit without rewriting unrelated fields", () => {
    expect(buildJournalTradeEditPatch(trade, {
      ...form,
      entry_price: 1.322457,
      position_size: 0.3,
    })).toEqual({
      entry_price: 1.322457,
      position_size: 0.3,
    });
  });

  it("updates a deliberately changed trade date but not the untouched exit time", () => {
    expect(buildJournalTradeEditPatch(trade, {
      ...form,
      entry_date: "2026-10-10T12:00:00.000Z",
    })).toEqual({ entry_date: "2026-10-10T12:00:00.000Z" });
  });

  it("clears exit and P&L when the status intentionally changes to open", () => {
    const closed: JournalTrade = { ...trade, pnl: 18.75 };
    const input: ManualTradeInput = {
      ...form, status: "open", exit_price: null, exit_date: null, pnl: null,
    };
    expect(buildJournalTradeEditPatch(closed, input)).toEqual({
      status: "open",
      exit_price: null,
      pnl: null,
      exit_date: null,
    });
  });

  it("preserves cancelled-trade P&L and exit details when only notes change", () => {
    const cancelled: JournalTrade = { ...trade, status: "cancelled", pnl: -16.25 };
    const input: ManualTradeInput = {
      ...form,
      status: "cancelled",
      pnl: -16.25,
      notes: "Reviewed cancelled setup",
      exit_date: cancelled.exit_date,
      exit_price: cancelled.exit_price,
    };
    expect(buildJournalTradeEditPatch(cancelled, input)).toEqual({
      notes: "Reviewed cancelled setup",
    });
  });

  it("keeps first-time structured edits of an empty notebook as a full save", () => {
    const draft: JournalTrade = { ...trade, journal_type: "notebook_draft" };
    expect(buildJournalTradeEditPatch(draft, form)).toEqual({
      ...form,
      market_condition: undefined,
      journal_type: "structured",
    });
  });
});
