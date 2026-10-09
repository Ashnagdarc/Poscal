import { describe, expect, it } from "vitest";
import {
  canonicalizePairSymbol,
  formatPriceForPair,
  getPairPriceDecimals,
  formatTradePrice,
  sanitizePriceInput,
} from "@/lib/pairFormat";

describe("pairFormat", () => {
  it("canonicalizes compact forex symbols", () => {
    expect(canonicalizePairSymbol("eurusd")).toBe("EUR/USD");
    expect(canonicalizePairSymbol("USDJPY")).toBe("USD/JPY");
    expect(canonicalizePairSymbol("XAU-USD")).toBe("XAU/USD");
  });

  it("returns instrument-aware decimals", () => {
    expect(getPairPriceDecimals("EURUSD")).toBe(5);
    expect(getPairPriceDecimals("GBP/USD")).toBe(5);
    expect(getPairPriceDecimals("USD/JPY")).toBe(3);
    expect(getPairPriceDecimals("GBP/JPY")).toBe(3);
    expect(getPairPriceDecimals("US500")).toBe(2);
    expect(getPairPriceDecimals("SOYBEAN/USD")).toBe(2);
    expect(getPairPriceDecimals("NATGAS/USD")).toBe(3);
    expect(getPairPriceDecimals("XAUUSD")).toBe(2);
    expect(getPairPriceDecimals("XAG/USD")).toBe(3);
  });

  it("sanitizes price typing to pair decimals", () => {
    expect(sanitizePriceInput("1.08567", 4)).toBe("1.0856");
    expect(sanitizePriceInput("150.259", 2)).toBe("150.25");
    expect(sanitizePriceInput("1.", 4)).toBe("1.");
    expect(sanitizePriceInput("-12.5", 2, true)).toBe("-12.5");
    expect(sanitizePriceInput("1.322456", 5, false, true)).toBe("1.322456");
    expect(sanitizePriceInput("1000.25", 2, false, true)).toBe("1000.25");
  });

  it("formats stored prices for the pair", () => {
    expect(formatPriceForPair(1.085, "EUR/USD")).toBe("1.08500");
    expect(formatPriceForPair(150.2, "USD/JPY")).toBe("150.200");
  });

  it("displays existing broker quotes without discarding stored precision", () => {
    expect(formatTradePrice(1.32245, "GBP/USD")).toBe("1.32245");
    expect(formatTradePrice(150.125, "USD/JPY")).toBe("150.125");
    expect(formatTradePrice(1.322456, "GBP/USD")).toBe("1.322456");
    expect(formatTradePrice(1000.25, "SOYBEAN/USD")).toBe("1000.25");
  });
});
