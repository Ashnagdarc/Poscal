import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("Calculator sizing dependencies", () => {
  it("does not import useRealtimePrices for position sizing", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "Calculator.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/useRealtimePrices/);
    expect(source).not.toMatch(/use-realtime-prices/);
    expect(source).not.toMatch(/priceSnapshots/);
    expect(source).toMatch(/conversionRate/);
    expect(source).toMatch(/userMarketPrices/);
  });
});
