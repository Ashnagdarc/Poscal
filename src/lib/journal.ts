import { STORAGE_KEYS } from "@/lib/constants";
import type { CalculatorHistoryItem } from "@/lib/calculatorHistory";

export type JournalStatus = "open" | "closed";

export interface JournalEntry {
  id: string;
  source: "manual" | "calculator";
  pair: string;
  direction: "buy" | "sell";
  status: JournalStatus;
  notes: string;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  plannedRiskPercent: number | null;
  positionSize: number | null;
  pnl: number | null;
  createdAt: string;
  updatedAt: string;
}

const isFiniteOrNull = (value: unknown) =>
  value === null || (typeof value === "number" && Number.isFinite(value));

const normalizeEntry = (value: Partial<JournalEntry>): JournalEntry | null => {
  if (
    typeof value.id !== "string" ||
    typeof value.pair !== "string" ||
    (value.direction !== "buy" && value.direction !== "sell") ||
    (value.status !== "open" && value.status !== "closed") ||
    typeof value.notes !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    (value.source !== "manual" && value.source !== "calculator") ||
    !isFiniteOrNull(value.entryPrice) ||
    !isFiniteOrNull(value.stopLoss) ||
    !isFiniteOrNull(value.takeProfit) ||
    !isFiniteOrNull(value.plannedRiskPercent) ||
    !isFiniteOrNull(value.positionSize) ||
    !isFiniteOrNull(value.pnl)
  ) {
    return null;
  }

  return {
    id: value.id,
    source: value.source,
    pair: value.pair,
    direction: value.direction,
    status: value.status,
    notes: value.notes,
    entryPrice: value.entryPrice,
    stopLoss: value.stopLoss,
    takeProfit: value.takeProfit,
    plannedRiskPercent: value.plannedRiskPercent,
    positionSize: value.positionSize,
    pnl: value.pnl,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const readJournalEntries = (): JournalEntry[] => {
  const raw = localStorage.getItem(STORAGE_KEYS.JOURNAL_ENTRIES);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<JournalEntry>>;
    return parsed
      .map(normalizeEntry)
      .filter((entry): entry is JournalEntry => entry !== null)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  } catch {
    return [];
  }
};

export const writeJournalEntries = (entries: JournalEntry[]) => {
  localStorage.setItem(STORAGE_KEYS.JOURNAL_ENTRIES, JSON.stringify(entries));
};

export const syncJournalWithCalculatorHistory = (history: CalculatorHistoryItem[]): JournalEntry[] => {
  const existing = readJournalEntries();
  const byId = new Map(existing.map((entry) => [entry.id, entry]));

  for (const item of history) {
    if (byId.has(item.id)) {
      continue;
    }

    byId.set(item.id, {
      id: item.id,
      source: "calculator",
      pair: item.pair,
      direction: item.direction ?? "buy",
      status: "open",
      notes: "Imported from calculator history",
      entryPrice: null,
      stopLoss: item.stopLoss,
      takeProfit: item.takeProfit,
      plannedRiskPercent: item.risk,
      positionSize: item.positionSize,
      pnl: null,
      createdAt: item.timestamp.toISOString(),
      updatedAt: item.timestamp.toISOString(),
    });
  }

  const nextEntries = Array.from(byId.values()).sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  writeJournalEntries(nextEntries);
  return nextEntries;
};

export const createJournalEntry = (
  input: Omit<JournalEntry, "id" | "source" | "createdAt" | "updatedAt">,
) => {
  const now = new Date().toISOString();
  const nextEntry: JournalEntry = {
    ...input,
    id: crypto.randomUUID(),
    source: "manual",
    createdAt: now,
    updatedAt: now,
  };

  const nextEntries = [nextEntry, ...readJournalEntries()];
  writeJournalEntries(nextEntries);
  return nextEntries;
};

export const updateJournalEntry = (id: string, updates: Partial<JournalEntry>) => {
  const nextEntries = readJournalEntries().map((entry) =>
    entry.id === id
      ? {
          ...entry,
          ...updates,
          id: entry.id,
          source: entry.source,
          updatedAt: new Date().toISOString(),
        }
      : entry,
  );

  writeJournalEntries(nextEntries);
  return nextEntries;
};
