import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { STORAGE_KEYS } from "@/lib/constants";

export type SavedCalculationSource = "manual" | "signal";
export type SavedCalculationOrderType =
  | "buy"
  | "sell"
  | "buy_limit"
  | "sell_limit"
  | "buy_stop"
  | "sell_stop";
export type SavedCalculationStatus =
  | "open"
  | "win"
  | "loss"
  | "breakeven"
  | "cancelled";

export interface CalculatorHistoryItem {
  id: string;
  pair: string;
  direction?: "buy" | "sell";
  balance: number;
  risk: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskReward: number;
  timestamp: Date;
}

export interface SavedCalculationRecord {
  id: string;
  userId?: string | null;
  symbol: string;
  orderType?: SavedCalculationOrderType | null;
  entryPrice: number | null;
  stopLossPrice: number | null;
  takeProfitPrice: number | null;
  accountBalance: number;
  riskPercent: number;
  riskAmount: number;
  lotSize: number;
  actualRisk: number | null;
  rewardToRisk: number | null;
  potentialProfit: number | null;
  source: SavedCalculationSource;
  signalId?: string | null;
  status: SavedCalculationStatus;
  pnlAmount?: number | null;
  resultR?: number | null;
  note?: string | null;
  screenshotUrls?: string[] | null;
  openedAt: Date;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stopLossPips?: number | null;
  takeProfitPips?: number | null;
}

export type JournalEntry = SavedCalculationRecord;

export interface SaveCalculatorHistoryInput extends CalculatorHistoryItem {
  riskAmount: number;
  units?: number;
  pipValue?: number;
  spreadPips?: number | null;
  priceSource?: string;
  symbol?: string;
  orderType?: SavedCalculationOrderType | null;
  entryPrice?: number | null;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
  lotSize?: number;
  actualRisk?: number | null;
  potentialProfit?: number | null;
  source?: SavedCalculationSource;
  signalId?: string | null;
  status?: SavedCalculationStatus;
  pnlAmount?: number | null;
  resultR?: number | null;
  note?: string | null;
  screenshotUrls?: string[] | null;
  openedAt?: Date | string | number | null;
  closedAt?: Date | string | number | null;
  updatedAt?: Date | string | number | null;
}

const HISTORY_LIMIT = 20;
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;

export const isConvexCalculatorHistoryEnabled = () => convexClient !== null;

const parseTimestamp = (value: unknown): Date => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return new Date();
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toSavedCalculationFromLegacyItem = (
  item: Partial<CalculatorHistoryItem>,
): SavedCalculationRecord => {
  const accountBalance = Number(item.balance ?? 0);
  const riskPercent = Number(item.risk ?? 0);
  const riskAmount = (accountBalance * riskPercent) / 100;

  return {
    id: String(item.id ?? Date.now()),
    userId: null,
    symbol: String(item.pair ?? "EUR/USD"),
    orderType: getOrderTypeFromDirection(item.direction),
    entryPrice: null,
    stopLossPrice: null,
    takeProfitPrice: null,
    accountBalance,
    riskPercent,
    riskAmount,
    lotSize: Number(item.positionSize ?? 0),
    actualRisk: riskAmount || null,
    rewardToRisk: Number(item.riskReward ?? 0) > 0 ? Number(item.riskReward) : null,
    potentialProfit: null,
    source: "manual",
    signalId: null,
    status: "open",
    pnlAmount: null,
    resultR: null,
    note: null,
    screenshotUrls: null,
    openedAt: parseTimestamp(item.timestamp),
    closedAt: null,
    createdAt: parseTimestamp(item.timestamp),
    updatedAt: parseTimestamp(item.timestamp),
    stopLossPips: Number(item.stopLoss ?? 0),
    takeProfitPips: Number(item.takeProfit ?? 0),
  };
};

const toSavedCalculationFromStoredItem = (item: Record<string, unknown>): SavedCalculationRecord => {
  if ("accountBalance" in item || "symbol" in item || "source" in item) {
    const accountBalance = Number(item.accountBalance ?? item.balance ?? 0);
    const riskPercent = Number(item.riskPercent ?? item.risk ?? 0);
    const riskAmount = parseOptionalNumber(item.riskAmount) ?? ((accountBalance * riskPercent) / 100);
    const lotSize = Number(item.lotSize ?? item.positionSize ?? 0);

    return {
      id: String(item.id ?? Date.now()),
      userId: typeof item.userId === "string" ? item.userId : null,
      symbol: String(item.symbol ?? item.pair ?? "EUR/USD"),
      orderType: (item.orderType as SavedCalculationOrderType | null | undefined)
        ?? getOrderTypeFromDirection(item.direction as "buy" | "sell" | undefined),
      entryPrice: parseOptionalNumber(item.entryPrice),
      stopLossPrice: parseOptionalNumber(item.stopLossPrice),
      takeProfitPrice: parseOptionalNumber(item.takeProfitPrice),
      accountBalance,
      riskPercent,
      riskAmount,
      lotSize,
      actualRisk: parseOptionalNumber(item.actualRisk) ?? riskAmount,
      rewardToRisk: parseOptionalNumber(item.rewardToRisk),
      potentialProfit: parseOptionalNumber(item.potentialProfit),
      source: item.source === "signal" ? "signal" : "manual",
      signalId: typeof item.signalId === "string" ? item.signalId : null,
      status: item.status === "win"
        || item.status === "loss"
        || item.status === "breakeven"
        || item.status === "cancelled"
        ? item.status
        : "open",
      pnlAmount: parseOptionalNumber(item.pnlAmount),
      resultR: parseOptionalNumber(item.resultR),
      note: typeof item.note === "string" ? item.note : null,
      screenshotUrls: Array.isArray(item.screenshotUrls)
        ? item.screenshotUrls.filter((value): value is string => typeof value === "string")
        : null,
      openedAt: parseTimestamp(item.openedAt ?? item.openedAtMs ?? item.createdAt ?? item.timestamp),
      closedAt: item.closedAt || item.closedAtMs ? parseTimestamp(item.closedAt ?? item.closedAtMs) : null,
      createdAt: parseTimestamp(item.createdAt ?? item.timestamp),
      updatedAt: parseTimestamp(item.updatedAt ?? item.updatedAtMs ?? item.createdAt ?? item.timestamp),
      stopLossPips: parseOptionalNumber(item.stopLossPips ?? item.stopLoss),
      takeProfitPips: parseOptionalNumber(item.takeProfitPips ?? item.takeProfit),
    };
  }

  return toSavedCalculationFromLegacyItem(item as Partial<CalculatorHistoryItem>);
};

const readLocalSavedCalculations = (): SavedCalculationRecord[] => {
  const savedHistory = localStorage.getItem(STORAGE_KEYS.POSITION_HISTORY);
  if (!savedHistory) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedHistory) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map(toSavedCalculationFromStoredItem);
  } catch (error) {
    console.warn("[calculator-history] Failed to parse local history", error);
    return [];
  }
};

const toCalculatorHistoryItem = (record: SavedCalculationRecord): CalculatorHistoryItem => ({
  id: record.id,
  pair: record.symbol,
  direction: getDirectionFromOrderType(record.orderType),
  balance: record.accountBalance,
  risk: record.riskPercent,
  stopLoss: record.stopLossPips ?? 0,
  takeProfit: record.takeProfitPips ?? 0,
  positionSize: record.lotSize,
  riskReward: record.rewardToRisk ?? 0,
  timestamp: record.createdAt,
});

export const readLocalCalculatorHistory = (): CalculatorHistoryItem[] => {
  return readLocalSavedCalculations().map(toCalculatorHistoryItem);
};

const writeLocalSavedCalculations = (history: SavedCalculationRecord[]) => {
  localStorage.setItem(STORAGE_KEYS.POSITION_HISTORY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
};

export const clearLocalCalculatorHistory = () => {
  localStorage.removeItem(STORAGE_KEYS.POSITION_HISTORY);
};

const getOrderTypeFromDirection = (
  direction?: "buy" | "sell",
): SavedCalculationOrderType | null => {
  if (direction === "sell") return "sell";
  if (direction === "buy") return "buy";
  return null;
};

const getDirectionFromOrderType = (
  orderType?: SavedCalculationOrderType | string | null,
): "buy" | "sell" => {
  if (!orderType) return "buy";
  return orderType.startsWith("sell") ? "sell" : "buy";
};

const toSavedCalculationRecord = (
  item: SaveCalculatorHistoryInput,
  userId?: string | null,
): SavedCalculationRecord => {
  const lotSize = item.lotSize ?? item.positionSize;
  const actualRisk = item.actualRisk
    ?? (
      item.pipValue !== undefined &&
      item.stopLoss > 0 &&
      lotSize > 0
        ? lotSize * item.stopLoss * item.pipValue
        : item.riskAmount
    );
  const rewardToRisk = item.riskReward > 0 ? item.riskReward : null;
  const potentialProfit = item.potentialProfit
    ?? (
      item.pipValue !== undefined &&
      item.takeProfit > 0 &&
      lotSize > 0
        ? lotSize * item.takeProfit * item.pipValue
        : null
    );

  return {
    id: item.id,
    userId: userId ?? null,
    symbol: item.symbol ?? item.pair,
    orderType: item.orderType ?? getOrderTypeFromDirection(item.direction),
    entryPrice: item.entryPrice ?? null,
    stopLossPrice: item.stopLossPrice ?? null,
    takeProfitPrice: item.takeProfitPrice ?? null,
    accountBalance: item.balance,
    riskPercent: item.risk,
    riskAmount: item.riskAmount,
    lotSize,
    actualRisk: actualRisk ?? null,
    rewardToRisk,
    potentialProfit: potentialProfit ?? null,
    source: item.source ?? "manual",
    signalId: item.signalId ?? null,
    status: item.status ?? "open",
    pnlAmount: item.pnlAmount ?? null,
    resultR: item.resultR ?? null,
    note: item.note ?? null,
    screenshotUrls: item.screenshotUrls ?? null,
    openedAt: parseTimestamp(item.openedAt ?? item.timestamp),
    closedAt: item.closedAt ? parseTimestamp(item.closedAt) : null,
    createdAt: item.timestamp,
    updatedAt: parseTimestamp(item.updatedAt ?? item.timestamp),
    stopLossPips: item.stopLoss,
    takeProfitPips: item.takeProfit,
  };
};

const toConvexInput = (userId: string, item: SaveCalculatorHistoryInput) => {
  const record = toSavedCalculationRecord(item, userId);

  return {
    userId,
    clientId: item.id,
    symbol: record.symbol,
    orderType: record.orderType ?? null,
    entryPrice: record.entryPrice,
    stopLossPrice: record.stopLossPrice,
    takeProfitPrice: record.takeProfitPrice,
    accountBalance: record.accountBalance,
    riskPercent: record.riskPercent,
    riskAmount: record.riskAmount,
    lotSize: record.lotSize,
    actualRisk: record.actualRisk,
    rewardToRisk: record.rewardToRisk,
    potentialProfit: record.potentialProfit,
    source: record.source,
    signalId: record.signalId ?? null,
    status: record.status,
    pnlAmount: record.pnlAmount ?? null,
    resultR: record.resultR ?? null,
    note: record.note ?? null,
    screenshotUrls: record.screenshotUrls ?? null,
    openedAtMs: record.openedAt.getTime(),
    closedAtMs: record.closedAt?.getTime() ?? null,
    stopLossPips: record.stopLossPips ?? null,
    takeProfitPips: record.takeProfitPips ?? null,
    createdAtMs: record.createdAt.getTime(),
    updatedAtMs: record.updatedAt.getTime(),
  };
};

const toConvexInputFromSavedRecord = (userId: string, record: SavedCalculationRecord) => {
  return {
    userId,
    clientId: record.id,
    symbol: record.symbol,
    orderType: record.orderType ?? null,
    entryPrice: record.entryPrice,
    stopLossPrice: record.stopLossPrice,
    takeProfitPrice: record.takeProfitPrice,
    accountBalance: record.accountBalance,
    riskPercent: record.riskPercent,
    riskAmount: record.riskAmount,
    lotSize: record.lotSize,
    actualRisk: record.actualRisk,
    rewardToRisk: record.rewardToRisk,
    potentialProfit: record.potentialProfit,
    source: record.source,
    signalId: record.signalId ?? null,
    status: record.status,
    pnlAmount: record.pnlAmount ?? null,
    resultR: record.resultR ?? null,
    note: record.note ?? null,
    screenshotUrls: record.screenshotUrls ?? null,
    openedAtMs: record.openedAt.getTime(),
    closedAtMs: record.closedAt?.getTime() ?? null,
    stopLossPips: record.stopLossPips ?? null,
    takeProfitPips: record.takeProfitPips ?? null,
    createdAtMs: record.createdAt.getTime(),
    updatedAtMs: record.updatedAt.getTime(),
  };
};

const fromConvexSavedRecord = (row: {
  _id: string;
  userId?: string | null;
  clientId?: string | null;
  symbol?: string | null;
  pair?: string | null;
  orderType?: SavedCalculationOrderType | null;
  direction?: "buy" | "sell";
  entryPrice?: number | null;
  stopLossPrice?: number | null;
  takeProfitPrice?: number | null;
  accountBalance: number;
  riskPercent: number;
  stopLossPips?: number | null;
  takeProfitPips?: number | null;
  riskAmount: number;
  lotSize?: number | null;
  positionSize?: number | null;
  actualRisk?: number | null;
  rewardToRisk?: number | null;
  potentialProfit?: number | null;
  source?: SavedCalculationSource | null;
  signalId?: string | null;
  status?: SavedCalculationStatus | null;
  pnlAmount?: number | null;
  resultR?: number | null;
  note?: string | null;
  screenshotUrls?: string[] | null;
  openedAtMs?: number | null;
  closedAtMs?: number | null;
  createdAtMs: number;
  updatedAtMs?: number | null;
}): SavedCalculationRecord => ({
  id: row.clientId ?? row._id,
  userId: row.userId ?? null,
  symbol: row.symbol ?? row.pair ?? "EUR/USD",
  orderType: row.orderType ?? getOrderTypeFromDirection(row.direction),
  entryPrice: row.entryPrice ?? null,
  stopLossPrice: row.stopLossPrice ?? null,
  takeProfitPrice: row.takeProfitPrice ?? null,
  accountBalance: row.accountBalance,
  riskPercent: row.riskPercent,
  riskAmount: row.riskAmount,
  lotSize: row.lotSize ?? row.positionSize ?? 0,
  actualRisk: row.actualRisk ?? row.riskAmount,
  rewardToRisk: row.rewardToRisk ?? null,
  potentialProfit: row.potentialProfit ?? null,
  source: row.source === "signal" ? "signal" : "manual",
  signalId: row.signalId ?? null,
  status: row.status === "win"
    || row.status === "loss"
    || row.status === "breakeven"
    || row.status === "cancelled"
    ? row.status
    : "open",
  pnlAmount: row.pnlAmount ?? null,
  resultR: row.resultR ?? null,
  note: row.note ?? null,
  screenshotUrls: row.screenshotUrls ?? null,
  openedAt: new Date(row.openedAtMs ?? row.createdAtMs),
  closedAt: row.closedAtMs ? new Date(row.closedAtMs) : null,
  createdAt: new Date(row.createdAtMs),
  updatedAt: new Date(row.updatedAtMs ?? row.createdAtMs),
  stopLossPips: row.stopLossPips ?? null,
  takeProfitPips: row.takeProfitPips ?? null,
});

const fromConvexRow = (row: {
  _id: string;
  clientId?: string | null;
  symbol?: string | null;
  pair?: string | null;
  orderType?: SavedCalculationOrderType | null;
  direction?: "buy" | "sell";
  accountBalance: number;
  riskPercent: number;
  stopLossPips?: number | null;
  takeProfitPips?: number | null;
  rewardToRisk?: number | null;
  lotSize?: number;
  positionSize?: number;
  riskAmount: number;
  createdAtMs: number;
}): CalculatorHistoryItem => {
  const record = fromConvexSavedRecord(row);
  const stopLossPips = record.stopLossPips ?? 0;
  const riskReward = record.rewardToRisk
    ?? (
      stopLossPips > 0
        ? ((record.takeProfitPips ?? 0) / stopLossPips)
        : 0
    );

  return {
    id: record.id,
    pair: record.symbol,
    direction: getDirectionFromOrderType(record.orderType),
    balance: record.accountBalance,
    risk: record.riskPercent,
    stopLoss: stopLossPips,
    takeProfit: record.takeProfitPips ?? 0,
    positionSize: record.lotSize,
    riskReward: Number.isFinite(riskReward) ? riskReward : 0,
    timestamp: record.createdAt,
  };
};

export const loadSavedCalculations = async (userId?: string | null): Promise<SavedCalculationRecord[]> => {
  if (!userId || !convexClient) {
    return readLocalSavedCalculations();
  }

  const rows = await convexClient.query(api.calculatorHistory.listForUser, {
    userId,
    limit: HISTORY_LIMIT,
  });

  return rows.map(fromConvexSavedRecord);
};

export const loadJournalEntries = loadSavedCalculations;

export const loadCalculatorHistory = async (userId?: string | null): Promise<CalculatorHistoryItem[]> => {
  const records = await loadSavedCalculations(userId);
  return records.map(toCalculatorHistoryItem);
};

export const saveCalculatorHistory = async (
  item: SaveCalculatorHistoryInput,
  userId?: string | null,
): Promise<CalculatorHistoryItem[]> => {
  const savedRecord = toSavedCalculationRecord(item, userId);
  const localHistory = [savedRecord, ...readLocalSavedCalculations().filter((existing) => existing.id !== savedRecord.id)]
    .slice(0, HISTORY_LIMIT);
  writeLocalSavedCalculations(localHistory);

  if (userId && convexClient) {
    await convexClient.mutation(api.calculatorHistory.save, toConvexInput(userId, item));
    return await loadCalculatorHistory(userId);
  }

  return localHistory.map(toCalculatorHistoryItem);
};

export const saveJournalEntry = saveCalculatorHistory;

export const migrateLocalCalculatorHistoryToConvex = async (userId?: string | null) => {
  if (!userId || !convexClient) {
    return;
  }

  const migrationKey = `${STORAGE_KEYS.POSITION_HISTORY}:convexMigrated:${userId}`;
  if (localStorage.getItem(migrationKey) === "1") {
    return;
  }

  const localHistory = readLocalSavedCalculations();
  if (localHistory.length === 0) {
    localStorage.setItem(migrationKey, "1");
    return;
  }

  await convexClient.mutation(api.calculatorHistory.saveMany, {
    items: localHistory.map((item) => toConvexInputFromSavedRecord(userId, item)),
  });

  localStorage.setItem(migrationKey, "1");
};

export const clearCalculatorHistory = async (userId?: string | null) => {
  clearLocalCalculatorHistory();

  if (userId && convexClient) {
    await convexClient.mutation(api.calculatorHistory.clearForUser, { userId });
  }
};

export const clearJournalEntries = clearCalculatorHistory;

export const deleteCalculatorHistoryItem = async (
  id: string,
  userId?: string | null,
): Promise<SavedCalculationRecord[]> => {
  const nextLocalHistory = readLocalSavedCalculations().filter((item) => item.id !== id);
  writeLocalSavedCalculations(nextLocalHistory);

  if (userId && convexClient) {
    await convexClient.mutation(api.calculatorHistory.remove, {
      userId,
      clientId: id,
    });
    return await loadSavedCalculations(userId);
  }

  return nextLocalHistory;
};

export const deleteJournalEntry = deleteCalculatorHistoryItem;

export const updateSavedCalculation = async (
  id: string,
  updates: Partial<SavedCalculationRecord>,
  userId?: string | null,
): Promise<SavedCalculationRecord[]> => {
  const currentItems = readLocalSavedCalculations();
  const existing = currentItems.find((item) => item.id === id);

  if (!existing) {
    throw new Error("Saved calculation not found");
  }

  const nextRecord: SavedCalculationRecord = {
    ...existing,
    ...updates,
    id: existing.id,
    userId: userId ?? existing.userId ?? null,
    updatedAt: updates.updatedAt ? parseTimestamp(updates.updatedAt) : new Date(),
    openedAt: updates.openedAt ? parseTimestamp(updates.openedAt) : existing.openedAt,
    closedAt: updates.closedAt === null
      ? null
      : updates.closedAt
        ? parseTimestamp(updates.closedAt)
        : existing.closedAt ?? null,
    createdAt: existing.createdAt,
  };

  const nextItems = currentItems.map((item) => (item.id === id ? nextRecord : item));
  writeLocalSavedCalculations(nextItems);

  if (userId && convexClient) {
    await convexClient.mutation(api.calculatorHistory.save, toConvexInputFromSavedRecord(userId, nextRecord));
    return await loadSavedCalculations(userId);
  }

  return nextItems;
};

export const updateJournalEntry = updateSavedCalculation;

export const migrateLocalJournalEntriesToConvex = migrateLocalCalculatorHistoryToConvex;
