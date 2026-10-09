import type { JournalTrade } from "@/lib/convexJournal";
import type { ManualTradeInput } from "@/hooks/queries/use-trades-query";
import { canonicalizePairSymbol } from "@/lib/pairFormat";

export type JournalTradeEditPatch = Partial<ManualTradeInput> & {
  journal_type?: "structured";
};

const directionKey = (direction: JournalTrade["direction"]): "long" | "short" =>
  direction === "short" || direction === "sell" ? "short" : "long";

const dateKey = (value: string | null | undefined): string | null =>
  value ? value.slice(0, 10) : null;

const numericKeys = [
  "entry_price",
  "exit_price",
  "stop_loss",
  "take_profit",
  "position_size",
  "risk_percent",
  "pnl",
] as const;

/**
 * Protect historical trade records from the Edit Trade form's round-trip
 * formatting and date-only inputs. Only modified fields are sent to Convex.
 * The market condition is not editable in this form and is never cleared.
 */
export function buildJournalTradeEditPatch(
  previous: JournalTrade,
  input: ManualTradeInput,
): JournalTradeEditPatch {
  // Saving the first structured details on an empty notebook is intentional.
  if (previous.journal_type === "notebook_draft") {
    const { market_condition: _ignored, ...details } = input;
    return { ...details, journal_type: "structured" };
  }

  const patch: JournalTradeEditPatch = {};

  if (canonicalizePairSymbol(previous.pair) !== canonicalizePairSymbol(input.pair)) {
    patch.pair = input.pair;
  }
  if (directionKey(previous.direction) !== directionKey(input.direction)) {
    patch.direction = input.direction;
  }
  if (previous.status !== input.status) patch.status = input.status;

  for (const key of numericKeys) {
    if ((previous[key] ?? null) !== (input[key] ?? null)) {
      patch[key] = input[key];
    }
  }

  if ((previous.notes ?? "").trim() !== (input.notes ?? "").trim()) {
    patch.notes = input.notes;
  }
  if ((previous.tags ?? "").trim() !== (input.tags ?? "").trim()) {
    patch.tags = input.tags ?? null;
  }

  // The form captures only dates. Equal calendar dates must preserve the
  // original ISO timestamp, including the time and timezone offset.
  if (input.entry_date !== undefined && dateKey(input.entry_date) !== dateKey(previous.entry_date)) {
    patch.entry_date = input.entry_date;
  }
  if (input.exit_date !== undefined && dateKey(input.exit_date) !== dateKey(previous.exit_date)) {
    patch.exit_date = input.exit_date;
  }

  if (previous.journal_type !== "structured") patch.journal_type = "structured";
  return patch;
}
