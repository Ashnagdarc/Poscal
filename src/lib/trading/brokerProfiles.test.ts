import { describe, expect, it } from "vitest";

import {
  resolveBrokerProfile,
  type BrokerProfileSnapshot,
} from "@/lib/trading/brokerProfiles";
import { calculatePositionSize } from "@/lib/positionSizeCalculator";

const snapshot: BrokerProfileSnapshot = {
  source: {
    name: "MetaTrader Broker Symbols",
    license: "CC BY 4.0",
    url: "https://github.com/metatraderVPS/metatrader-broker-symbols",
    snapshotCommit: "test",
    snapshotDate: "2026-10-06",
    note: "test fixture",
  },
  brokers: {
    "test-broker": {
      name: "Test Broker",
      platform: "MT5",
      servers: ["Test-Demo"],
      symbols: {
        "GBP/USD": {
          symbol: "GBPUSD.raw",
          contractSize: 100000,
          minLot: 0.01,
          lotStep: 0.01,
          digits: 5,
        },
        US500: {
          symbol: "US500.cash",
          contractSize: 10,
          minLot: 1,
          lotStep: 1,
          digits: 2,
        },
        "XAU/USD": {
          symbol: "GOLD",
        },
      },
    },
  },
};

describe("broker profile resolver", () => {
  it("builds a sizing override only from measured positive fields", () => {
    const resolved = resolveBrokerProfile(snapshot, "test-broker", "GBP/USD");
    expect(resolved?.brokerName).toBe("Test Broker");
    expect(resolved?.brokerSymbol).toBe("GBPUSD.raw");
    expect(resolved?.hasSizingData).toBe(true);
    expect(resolved?.override).toMatchObject({
      source: "broker-profile",
      contractSize: 100000,
      minLot: 0.01,
      lotStep: 0.01,
    });
  });

  it("keeps Poscal fallback when the broker entry has only a symbol name", () => {
    const resolved = resolveBrokerProfile(snapshot, "test-broker", "XAU/USD");
    expect(resolved?.brokerSymbol).toBe("GOLD");
    expect(resolved?.hasSizingData).toBe(false);
    expect(resolved?.override).toBeNull();
  });

  it("changes sizing when the measured broker contract differs", () => {
    const standard = calculatePositionSize({
      symbol: "US500",
      accountBalance: 100000,
      riskPercent: 1,
      stopLossPips: 50,
    });
    const broker = resolveBrokerProfile(snapshot, "test-broker", "US500");
    const profiled = calculatePositionSize({
      symbol: "US500",
      accountBalance: 100000,
      riskPercent: 1,
      stopLossPips: 50,
      instrumentSpecOverride: broker?.override,
    });

    expect(standard.isValid).toBe(true);
    expect(profiled.isValid).toBe(true);
    expect(standard.positionSize).toBe(20);
    expect(profiled.positionSize).toBe(2);
    expect(profiled.specSource).toBe("broker-profile");
    expect(profiled.spec?.minLot).toBe(1);
    expect(profiled.spec?.lotStep).toBe(1);
  });
});
