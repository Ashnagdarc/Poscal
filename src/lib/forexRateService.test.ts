import { describe, expect, it, vi } from "vitest";
import {
  fetchForexMidPrices,
  midPricesFromUsdRates,
  pickMarketPrices,
} from "./forexRateService";

describe("forexRateService", () => {
  it("maps USD-based ECB rates into slash pairs used by the calculator", () => {
    const prices = midPricesFromUsdRates({
      EUR: 0.92,
      GBP: 0.79,
      JPY: 150,
      CHF: 0.88,
      CAD: 1.36,
      AUD: 1.52,
      NZD: 1.66,
      INR: 83,
      ZAR: 18,
      NGN: 1600,
    });

    expect(prices["EUR/USD"]).toBeCloseTo(1 / 0.92, 6);
    expect(prices["GBP/USD"]).toBeCloseTo(1 / 0.79, 6);
    expect(prices["USD/JPY"]).toBe(150);
    expect(prices["USD/CHF"]).toBe(0.88);
    expect(prices["USD/CAD"]).toBe(1.36);
    expect(prices["AUD/USD"]).toBeCloseTo(1 / 1.52, 6);
    expect(prices["NGN/USD"]).toBeCloseTo(1 / 1600, 8);
    expect(prices["INR/USD"]).toBeCloseTo(1 / 83, 6);
  });

  it("picks only requested conversion pairs", () => {
    const picked = pickMarketPrices(
      { "USD/JPY": 150, "GBP/USD": 1.27, "EUR/USD": 1.1 },
      ["USD/JPY", null, "GBP/USD"],
    );

    expect(picked).toEqual({ "USD/JPY": 150, "GBP/USD": 1.27 });
  });

  it("fetches and maps Frankfurter latest rates", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rates: { EUR: 0.92, GBP: 0.79, JPY: 149.5, CHF: 0.88, CAD: 1.36, AUD: 1.5, NZD: 1.6 },
      }),
    })) as unknown as typeof fetch;

    const prices = await fetchForexMidPrices(fetchImpl);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(prices["USD/JPY"]).toBe(149.5);
    expect(prices["GBP/USD"]).toBeCloseTo(1 / 0.79, 6);
  });
});
