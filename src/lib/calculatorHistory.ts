import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { STORAGE_KEYS } from "@/lib/constants";

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

export interface SaveCalculatorHistoryInput extends CalculatorHistoryItem {
  riskAmount: number;
  units: number;
  pipValue: number;
  spreadPips?: number | null;
  priceSource: string;
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

export const readLocalCalculatorHistory = (): CalculatorHistoryItem[] => {
  const savedHistory = localStorage.getItem(STORAGE_KEYS.POSITION_HISTORY);
  if (!savedHistory) {
    return [];
  }

  try {
    const parsed = JSON.parse(savedHistory) as Array<Partial<CalculatorHistoryItem>>;
    return parsed.map((item) => ({
      id: String(item.id ?? Date.now()),
      pair: String(item.pair ?? "EUR/USD"),
      direction: item.direction === "sell" ? "sell" : "buy",
      balance: Number(item.balance ?? 0),
      risk: Number(item.risk ?? 0),
      stopLoss: Number(item.stopLoss ?? 0),
      takeProfit: Number(item.takeProfit ?? 0),
      positionSize: Number(item.positionSize ?? 0),
      riskReward: Number(item.riskReward ?? 0),
      timestamp: parseTimestamp(item.timestamp),
    }));
  } catch (error) {
    console.warn("[calculator-history] Failed to parse local history", error);
    return [];
  }
};

export const writeLocalCalculatorHistory = (history: CalculatorHistoryItem[]) => {
  localStorage.setItem(STORAGE_KEYS.POSITION_HISTORY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
};

export const clearLocalCalculatorHistory = () => {
  localStorage.removeItem(STORAGE_KEYS.POSITION_HISTORY);
};

const toConvexInput = (userId: string, item: SaveCalculatorHistoryInput) => ({
  userId,
  clientId: item.id,
  pair: item.pair,
  direction: item.direction ?? "buy",
  accountBalance: item.balance,
  riskPercent: item.risk,
  stopLossPips: item.stopLoss,
  takeProfitPips: item.takeProfit,
  riskAmount: item.riskAmount,
  positionSize: item.positionSize,
  units: item.units,
  pipValue: item.pipValue,
  spreadPips: item.spreadPips ?? null,
  priceSource: item.priceSource,
  createdAtMs: item.timestamp.getTime(),
});

const fromConvexRow = (row: {
  _id: string;
  clientId?: string | null;
  pair: string;
  direction: "buy" | "sell";
  accountBalance: number;
  riskPercent: number;
  stopLossPips: number;
  takeProfitPips?: number | null;
  positionSize: number;
  riskAmount: number;
  createdAtMs: number;
}): CalculatorHistoryItem => {
  const riskReward = row.riskAmount > 0
    ? ((row.takeProfitPips ?? 0) / row.stopLossPips)
    : 0;

  return {
    id: row.clientId ?? row._id,
    pair: row.pair,
    direction: row.direction,
    balance: row.accountBalance,
    risk: row.riskPercent,
    stopLoss: row.stopLossPips,
    takeProfit: row.takeProfitPips ?? 0,
    positionSize: row.positionSize,
    riskReward: Number.isFinite(riskReward) ? riskReward : 0,
    timestamp: new Date(row.createdAtMs),
  };
};

export const loadCalculatorHistory = async (userId?: string | null): Promise<CalculatorHistoryItem[]> => {
  if (!userId || !convexClient) {
    return readLocalCalculatorHistory();
  }

  const rows = await convexClient.query(api.calculatorHistory.listForUser, {
    userId,
    limit: HISTORY_LIMIT,
  });

  return rows.map(fromConvexRow);
};

export const saveCalculatorHistory = async (
  item: SaveCalculatorHistoryInput,
  userId?: string | null,
): Promise<CalculatorHistoryItem[]> => {
  const localHistory = [item, ...readLocalCalculatorHistory().filter((existing) => existing.id !== item.id)].slice(0, HISTORY_LIMIT);
  writeLocalCalculatorHistory(localHistory);

  if (userId && convexClient) {
    await convexClient.mutation(api.calculatorHistory.save, toConvexInput(userId, item));
    return await loadCalculatorHistory(userId);
  }

  return localHistory;
};

export const migrateLocalCalculatorHistoryToConvex = async (userId?: string | null) => {
  if (!userId || !convexClient) {
    return;
  }

  const migrationKey = `${STORAGE_KEYS.POSITION_HISTORY}:convexMigrated:${userId}`;
  if (localStorage.getItem(migrationKey) === "1") {
    return;
  }

  const localHistory = readLocalCalculatorHistory();
  if (localHistory.length === 0) {
    localStorage.setItem(migrationKey, "1");
    return;
  }

  await convexClient.mutation(api.calculatorHistory.saveMany, {
    items: localHistory.map((item) => toConvexInput(userId, {
      ...item,
      riskAmount: item.balance * item.risk / 100,
      units: item.positionSize * 100000,
      pipValue: item.stopLoss > 0 && item.positionSize > 0
        ? (item.balance * item.risk / 100) / (item.stopLoss * item.positionSize)
        : 0,
      priceSource: "local_migration",
      spreadPips: null,
    })),
  });

  localStorage.setItem(migrationKey, "1");
};

export const clearCalculatorHistory = async (userId?: string | null) => {
  clearLocalCalculatorHistory();

  if (userId && convexClient) {
    await convexClient.mutation(api.calculatorHistory.clearForUser, { userId });
  }
};
