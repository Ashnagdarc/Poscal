import { describe, expect, it } from "vitest";
import {
  formatPairTokenForDisplay,
  suggestPairToken,
  validateTradePairInput,
} from "@/lib/supportedPairs";

describe("supportedPairs", () => {
  it("suggests full gold symbol from partial typing", () => {
    expect(suggestPairToken("XAUUS")).toBe("XAUUSD");
    expect(suggestPairToken("xauus")).toBe("XAUUSD");
  });

  it("accepts valid compact and slash forms", () => {
    expect(validateTradePairInput("XAUUSD").ok).toBe(true);
    expect(validateTradePairInput("XAU/USD").ok).toBe(true);
    expect(validateTradePairInput("eurusd").ok).toBe(true);
  });

  it("explains unknown symbols with a suggestion when possible", () => {
    const result = validateTradePairInput("XAUUS");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.suggestion).toBe("XAUUSD");
    expect(result.message).toMatch(/Did you mean XAU\/USD/i);
  });

  it("formats display tokens", () => {
    expect(formatPairTokenForDisplay("XAUUSD")).toBe("XAU/USD");
    expect(formatPairTokenForDisplay("US30")).toBe("US30");
  });
});
