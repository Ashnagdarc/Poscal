import { STORAGE_KEYS } from "@/lib/constants";

export type SignalOrderType = "limit" | "market";

export interface TradeSignal {
  id: string;
  symbol: string;
  orderType: SignalOrderType;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  link: string | null;
  createdAt: string;
}

const isValidNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const normalizeSignal = (value: Partial<TradeSignal>): TradeSignal | null => {
  if (
    typeof value.id !== "string" ||
    typeof value.symbol !== "string" ||
    (value.orderType !== "limit" && value.orderType !== "market") ||
    !isValidNumber(value.entry) ||
    !isValidNumber(value.stopLoss) ||
    !isValidNumber(value.takeProfit) ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    symbol: value.symbol.toUpperCase(),
    orderType: value.orderType,
    entry: value.entry,
    stopLoss: value.stopLoss,
    takeProfit: value.takeProfit,
    link: typeof value.link === "string" && value.link.trim().length > 0 ? value.link.trim() : null,
    createdAt: value.createdAt,
  };
};

export const inferSignalDirection = (signal: Pick<TradeSignal, "entry" | "stopLoss" | "takeProfit">): "buy" | "sell" | null => {
  if (signal.takeProfit > signal.entry && signal.stopLoss < signal.entry) {
    return "buy";
  }

  if (signal.takeProfit < signal.entry && signal.stopLoss > signal.entry) {
    return "sell";
  }

  return null;
};

export const readSignals = (): TradeSignal[] => {
  const raw = localStorage.getItem(STORAGE_KEYS.SIGNALS);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as Array<Partial<TradeSignal>>;
    return parsed
      .map(normalizeSignal)
      .filter((signal): signal is TradeSignal => signal !== null)
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  } catch {
    return [];
  }
};

export const writeSignals = (signals: TradeSignal[]) => {
  localStorage.setItem(STORAGE_KEYS.SIGNALS, JSON.stringify(signals));
};

export const saveSignal = (input: Omit<TradeSignal, "id" | "createdAt">): TradeSignal[] => {
  const nextSignal: TradeSignal = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const signals = [nextSignal, ...readSignals()];
  writeSignals(signals);
  return signals;
};

export const deleteSignal = (id: string): TradeSignal[] => {
  const signals = readSignals().filter((signal) => signal.id !== id);
  writeSignals(signals);
  return signals;
};

export const setPendingSignal = (signal: TradeSignal) => {
  localStorage.setItem(STORAGE_KEYS.PENDING_SIGNAL, JSON.stringify(signal));
};

export const readPendingSignal = (): TradeSignal | null => {
  const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SIGNAL);
  if (!raw) {
    return null;
  }

  try {
    return normalizeSignal(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const clearPendingSignal = () => {
  localStorage.removeItem(STORAGE_KEYS.PENDING_SIGNAL);
};
