import { describe, expect, it } from "vitest";

import {
  resolveAutomaticBrokerProfile,
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

  it("uses a specifically selected broker's quote digits without changing pip size", () => {
    const resolved = resolveBrokerProfile(snapshot, "test-broker", "GBP/USD");
    expect(resolved?.override?.quoteDigits).toBe(5);
    const spec = calculatePositionSize({
      symbol: "GBP/USD",
      accountBalance: 2000,
      riskPercent: 1,
      stopLossPips: 50,
      instrumentSpecOverride: resolved?.override,
    }).spec;
    expect(spec?.quoteDigits).toBe(5);
    expect(spec?.pipSize).toBe(0.0001);
    expect(spec?.pipValuePerStandardLot).toBeCloseTo(10);
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


describe("automatic broker profile resolver", () => {
  it("chooses the largest complete sizing consensus and ignores outliers", () => {
    const consensusSnapshot: BrokerProfileSnapshot = {
      ...snapshot,
      brokers: {
        a: {
          name: "Broker A",
          platform: "MT5",
          servers: ["A-Demo"],
          symbols: {
            "GBP/USD": { symbol: "GBPUSD", contractSize: 100000, minLot: 0.01, lotStep: 0.01 },
          },
        },
        b: {
          name: "Broker B",
          platform: "MT4",
          servers: ["B-Demo"],
          symbols: {
            "GBP/USD": { symbol: "GBPUSD", contractSize: 100000, minLot: 0.01, lotStep: 0.01 },
          },
        },
        c: {
          name: "Broker C",
          platform: "MT5",
          servers: ["C-Demo"],
          symbols: {
            "GBP/USD": { symbol: "GBPUSD", contractSize: 1000, minLot: 1, lotStep: 1 },
          },
        },
        incomplete: {
          name: "Incomplete",
          platform: "MT5",
          servers: ["I-Demo"],
          symbols: {
            "GBP/USD": { symbol: "GBPUSD" },
          },
        },
      },
    };

    const resolved = resolveAutomaticBrokerProfile(consensusSnapshot, "GBP/USD", 5);

    expect(resolved?.candidateCount).toBe(3);
    expect(resolved?.selectedProfiles.map((profile) => profile.brokerName)).toEqual([
      "Broker A",
      "Broker B",
    ]);
    expect(resolved?.override).toMatchObject({
      source: "broker-profile",
      contractSize: 100000,
      minLot: 0.01,
      lotStep: 0.01,
    });
  });

  it("uses at most five agreeing profiles and falls back when no complete data exists", () => {
    const many = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => [
        `broker-${index}`,
        {
          name: `Broker ${index}`,
          platform: "MT5",
          servers: [`Demo-${index}`],
          symbols: {
            US500: { symbol: "US500", contractSize: 10, minLot: 0.1, lotStep: 0.1 },
          },
        },
      ]),
    );

    const resolved = resolveAutomaticBrokerProfile(
      { ...snapshot, brokers: many },
      "US500",
      5,
    );
    expect(resolved?.selectedProfiles).toHaveLength(5);

    const fallback = resolveAutomaticBrokerProfile(
      {
        ...snapshot,
        brokers: {
          onlyMapping: {
            name: "Mapping Only",
            platform: "MT5",
            servers: ["Demo"],
            symbols: { "XAU/USD": { symbol: "GOLD" } },
          },
        },
      },
      "XAU/USD",
    );

    expect(fallback?.hasSizingData).toBe(false);
    expect(fallback?.override).toBeNull();
  });
});
