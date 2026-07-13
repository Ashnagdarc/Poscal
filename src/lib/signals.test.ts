import { beforeEach, describe, expect, it } from "vitest";

import {
  clearPendingSignal,
  deleteSignal,
  inferSignalDirection,
  readPendingSignal,
  readSignals,
  saveSignal,
  setPendingSignal,
  type TradeSignal,
} from "@/lib/signals";

describe("signals storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and reads signals in reverse chronological order", () => {
    const firstBatch = saveSignal({
      symbol: "eur/usd",
      orderType: "limit",
      entry: 1.1,
      stopLoss: 1.095,
      takeProfit: 1.11,
      link: null,
    });

    const secondBatch = saveSignal({
      symbol: "xau/usd",
      orderType: "market",
      entry: 2400,
      stopLoss: 2390,
      takeProfit: 2420,
      link: "https://example.com",
    });

    expect(firstBatch).toHaveLength(1);
    expect(secondBatch).toHaveLength(2);

    const signals = readSignals();
    expect(signals).toHaveLength(2);
    expect(signals[0]?.symbol).toBe("XAU/USD");
    expect(signals[1]?.symbol).toBe("EUR/USD");
  });

  it("deletes a saved signal", () => {
    const [savedSignal] = saveSignal({
      symbol: "EUR/USD",
      orderType: "limit",
      entry: 1.1,
      stopLoss: 1.095,
      takeProfit: 1.11,
      link: null,
    });

    expect(savedSignal).toBeDefined();
    const nextSignals = deleteSignal(savedSignal!.id);

    expect(nextSignals).toEqual([]);
    expect(readSignals()).toEqual([]);
  });

  it("stores and clears a pending signal for calculator apply", () => {
    const signal: TradeSignal = {
      id: "signal-1",
      symbol: "EUR/USD",
      orderType: "limit",
      entry: 1.1,
      stopLoss: 1.095,
      takeProfit: 1.11,
      link: null,
      createdAt: new Date().toISOString(),
    };

    setPendingSignal(signal);
    expect(readPendingSignal()).toEqual(signal);

    clearPendingSignal();
    expect(readPendingSignal()).toBeNull();
  });

  it("infers buy and sell direction from signal structure", () => {
    expect(inferSignalDirection({ entry: 1.1, stopLoss: 1.095, takeProfit: 1.11 })).toBe("buy");
    expect(inferSignalDirection({ entry: 1.1, stopLoss: 1.105, takeProfit: 1.09 })).toBe("sell");
    expect(inferSignalDirection({ entry: 1.1, stopLoss: 1.095, takeProfit: 1.09 })).toBeNull();
  });
});
