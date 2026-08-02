import { describe, expect, it } from "vitest";
import {
  canonicalizePairSymbol,
  formatPriceForPair,
  getPairPriceDecimals,
  sanitizePriceInput,
} from "@/lib/pairFormat";

describe("pairFormat", () => {
  it("canonicalizes compact forex symbols", () => {
    expect(canonicalizePairSymbol("eurusd")).toBe("EUR/USD");
    expect(canonicalizePairSymbol("USDJPY")).toBe("USD/JPY");
    expect(canonicalizePairSymbol("XAU-USD")).toBe("XAU/USD");
  });

  it("returns instrument-aware decimals", () => {
    expect(getPairPriceDecimals("EURUSD")).toBe(4);
    expect(getPairPriceDecimals("USD/JPY")).toBe(2);
    expect(getPairPriceDecimals("XAUUSD")).toBe(2);
    expect(getPairPriceDecimals("XAG/USD")).toBe(3);
  });

  it("sanitizes price typing to pair decimals", () => {
    expect(sanitizePriceInput("1.08567", 4)).toBe("1.0856");
    expect(sanitizePriceInput("150.259", 2)).toBe("150.25");
    expect(sanitizePriceInput("1.", 4)).toBe("1.");
    expect(sanitizePriceInput("-12.5", 2, true)).toBe("-12.5");
  });

  it("formats stored prices for the pair", () => {
    expect(formatPriceForPair(1.085, "EUR/USD")).toBe("1.0850");
    expect(formatPriceForPair(150.2, "USD/JPY")).toBe("150.20");
  });
});
