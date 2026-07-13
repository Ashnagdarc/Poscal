import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFallbackMarketPrices } from "./marketDataFallback";

describe("fetchFallbackMarketPrices", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives forex prices from public exchange rates", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      expect(input).toBe("https://open.er-api.com/v6/latest/USD");
      return {
        ok: true,
        json: async () => ({
          rates: {
            JPY: 157,
          },
        }),
      } as Response;
    });

    const result = await fetchFallbackMarketPrices(["USD/JPY"]);

    expect(result.prices["USD/JPY"]).toBe(157);
    expect(result.askPrices["USD/JPY"]).toBeGreaterThan(result.bidPrices["USD/JPY"]);
  });

  it("loads crypto prices from the optional public provider", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      expect(input).toBe("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd");
      return {
        ok: true,
        json: async () => ({
          bitcoin: {
            usd: 68000,
          },
        }),
      } as Response;
    });

    const result = await fetchFallbackMarketPrices(["BTC/USD"]);

    expect(result.prices["BTC/USD"]).toBe(68000);
    expect(result.askPrices["BTC/USD"]).toBeGreaterThan(result.bidPrices["BTC/USD"]);
  });

  it("falls back to static rates when public data fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const result = await fetchFallbackMarketPrices(["EUR/USD"]);

    expect(result.prices["EUR/USD"]).toBe(1.09);
    expect(result.askPrices["EUR/USD"]).toBeGreaterThan(result.bidPrices["EUR/USD"]);
  });
});
