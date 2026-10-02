import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Calculator sizing dependencies", () => {
  it("auto-loads conversion rates instead of a realtime price hook", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "Calculator.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/useRealtimePrices/);
    expect(source).not.toMatch(/use-realtime-prices/);
    expect(source).toMatch(/useAutoMarketPrices/);
    expect(source).toMatch(/conversionRate/);
    expect(source).toMatch(/userMarketPrices/);
    expect(source).toMatch(/if \(calculationMode !== "pips"\) return/);
    expect(source).toMatch(/journalId: activeJournalId/);
    expect(source).toMatch(/potentialProfitAccount/);
    expect(source).not.toMatch(/setSelectedPair\(FEATURED_CURRENCY_PAIRS\[0\]\)/);
    expect(source).toMatch(/raises actual risk/);
    expect(source).toMatch(/capped at/);
  });
});
