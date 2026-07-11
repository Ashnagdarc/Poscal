import { TYPICAL_SPREADS, spreadPipsToPrice } from "@/lib/forexCalculations";

type FallbackPrices = {
  prices: Record<string, number>;
  askPrices: Record<string, number>;
  bidPrices: Record<string, number>;
  timestamps: Record<string, string>;
};

function getTypicalSpread(symbol: string) {
  return TYPICAL_SPREADS[symbol] || 2;
}

function getSpreadInPrice(symbol: string, spreadPips: number) {
  return spreadPipsToPrice(symbol, spreadPips);
}

function isCrypto(symbol: string) {
  return symbol.includes("BTC") || symbol.includes("ETH") || symbol.includes("USDT");
}

function isMetal(symbol: string) {
  return symbol.includes("XAU") || symbol.includes("XAG");
}

function getStaticFallbackRate(symbol: string) {
  const fallbackRates: Record<string, number> = {
    "EUR/USD": 1.09,
    "GBP/USD": 1.27,
    "USD/JPY": 157,
    "USD/CHF": 0.85,
    "AUD/USD": 0.66,
    "USD/CAD": 1.44,
    "NZD/USD": 0.58,
    "EUR/GBP": 0.86,
    "EUR/JPY": 171,
    "GBP/JPY": 211,
    "AUD/JPY": 103,
    "EUR/CHF": 0.93,
    "GBP/CHF": 1.08,
    "XAU/USD": 2350,
    "XAG/USD": 31,
    "BTC/USD": 95000,
    "ETH/USD": 3400,
  };

  return fallbackRates[symbol] ?? 1;
}

function withEstimatedSpread(symbol: string, midPrice: number) {
  const halfSpread = getSpreadInPrice(symbol, getTypicalSpread(symbol)) / 2;
  return {
    midPrice,
    askPrice: midPrice + halfSpread,
    bidPrice: midPrice - halfSpread,
  };
}

async function fetchForexFallback(symbols: string[]): Promise<FallbackPrices> {
  const prices: Record<string, number> = {};
  const askPrices: Record<string, number> = {};
  const bidPrices: Record<string, number> = {};
  const timestamps: Record<string, string> = {};

  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) {
      throw new Error("ExchangeRate API failed");
    }

    const payload = await response.json();
    const rates = payload.rates as Record<string, number>;
    const timestamp = new Date().toISOString();

    for (const symbol of symbols) {
      const [base, quote] = symbol.split("/");
      let midPrice: number | null = null;

      if (base === "USD" && rates[quote]) {
        midPrice = rates[quote];
      } else if (quote === "USD" && rates[base]) {
        midPrice = 1 / rates[base];
      } else if (rates[base] && rates[quote]) {
        midPrice = rates[quote] / rates[base];
      }

      const { midPrice: finalMid, askPrice, bidPrice } = withEstimatedSpread(
        symbol,
        midPrice ?? getStaticFallbackRate(symbol),
      );

      prices[symbol] = finalMid;
      askPrices[symbol] = askPrice;
      bidPrices[symbol] = bidPrice;
      timestamps[symbol] = timestamp;
    }
  } catch {
    const timestamp = new Date().toISOString();
    for (const symbol of symbols) {
      const { midPrice, askPrice, bidPrice } = withEstimatedSpread(symbol, getStaticFallbackRate(symbol));
      prices[symbol] = midPrice;
      askPrices[symbol] = askPrice;
      bidPrices[symbol] = bidPrice;
      timestamps[symbol] = timestamp;
    }
  }

  return { prices, askPrices, bidPrices, timestamps };
}

async function fetchCryptoFallback(symbols: string[]): Promise<FallbackPrices> {
  const prices: Record<string, number> = {};
  const askPrices: Record<string, number> = {};
  const bidPrices: Record<string, number> = {};
  const timestamps: Record<string, string> = {};

  try {
    const coinIds: string[] = [];
    if (symbols.some((symbol) => symbol.includes("BTC"))) coinIds.push("bitcoin");
    if (symbols.some((symbol) => symbol.includes("ETH"))) coinIds.push("ethereum");

    if (coinIds.length === 0) {
      return { prices, askPrices, bidPrices, timestamps };
    }

    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd`,
    );
    if (!response.ok) {
      throw new Error("CoinGecko API failed");
    }

    const payload = await response.json();
    const timestamp = new Date().toISOString();

    for (const symbol of symbols) {
      let midPrice: number | null = null;
      if (symbol.includes("BTC") && payload.bitcoin?.usd) {
        midPrice = payload.bitcoin.usd;
      } else if (symbol.includes("ETH") && payload.ethereum?.usd) {
        midPrice = payload.ethereum.usd;
      }

      const { midPrice: finalMid, askPrice, bidPrice } = withEstimatedSpread(
        symbol,
        midPrice ?? getStaticFallbackRate(symbol),
      );

      prices[symbol] = finalMid;
      askPrices[symbol] = askPrice;
      bidPrices[symbol] = bidPrice;
      timestamps[symbol] = timestamp;
    }
  } catch {
    const timestamp = new Date().toISOString();
    for (const symbol of symbols) {
      const { midPrice, askPrice, bidPrice } = withEstimatedSpread(symbol, getStaticFallbackRate(symbol));
      prices[symbol] = midPrice;
      askPrices[symbol] = askPrice;
      bidPrices[symbol] = bidPrice;
      timestamps[symbol] = timestamp;
    }
  }

  return { prices, askPrices, bidPrices, timestamps };
}

async function fetchMetalFallback(symbols: string[]): Promise<FallbackPrices> {
  const prices: Record<string, number> = {};
  const askPrices: Record<string, number> = {};
  const bidPrices: Record<string, number> = {};
  const timestamps: Record<string, string> = {};
  const timestamp = new Date().toISOString();

  for (const symbol of symbols) {
    const { midPrice, askPrice, bidPrice } = withEstimatedSpread(symbol, getStaticFallbackRate(symbol));
    prices[symbol] = midPrice;
    askPrices[symbol] = askPrice;
    bidPrices[symbol] = bidPrice;
    timestamps[symbol] = timestamp;
  }

  return { prices, askPrices, bidPrices, timestamps };
}

export async function fetchFallbackMarketPrices(symbols: string[]): Promise<FallbackPrices> {
  const forexSymbols = symbols.filter((symbol) => !isCrypto(symbol) && !isMetal(symbol));
  const cryptoSymbols = symbols.filter(isCrypto);
  const metalSymbols = symbols.filter(isMetal);

  const [forex, crypto, metals] = await Promise.all([
    fetchForexFallback(forexSymbols),
    fetchCryptoFallback(cryptoSymbols),
    fetchMetalFallback(metalSymbols),
  ]);

  return {
    prices: { ...forex.prices, ...crypto.prices, ...metals.prices },
    askPrices: { ...forex.askPrices, ...crypto.askPrices, ...metals.askPrices },
    bidPrices: { ...forex.bidPrices, ...crypto.bidPrices, ...metals.bidPrices },
    timestamps: { ...forex.timestamps, ...crypto.timestamps, ...metals.timestamps },
  };
}
