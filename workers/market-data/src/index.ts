type Env = {
  CONVEX_URL: string;
  FINNHUB_API_KEY: string;
  PRICE_INGEST_SECRET: string;
  POLL_SYMBOLS?: string;
  ESTIMATED_SPREAD_BPS?: string;
};

type QuoteResponse = {
  c?: number;
  t?: number;
};

const DEFAULT_SYMBOLS = ["BTC/USD", "ETH/USD"];

const DEFAULT_PROVIDER_SYMBOLS: Record<string, string> = {
  "BTC/USD": "BINANCE:BTCUSDT",
  "ETH/USD": "BINANCE:ETHUSDT",
};

function parseSpreadBps(raw: string | undefined) {
  const parsed = Number(raw ?? "1");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

function parseSymbolConfig(raw: string | undefined) {
  const values = (raw ? raw.split(",") : DEFAULT_SYMBOLS).map((item) => item.trim()).filter(Boolean);
  return values.map((item) => {
    if (item.includes("=")) {
      const [displaySymbol, providerSymbol] = item.split("=", 2).map((part) => part.trim());
      if (!displaySymbol || !providerSymbol) {
        throw new Error(`Invalid POLL_SYMBOLS entry: ${item}`);
      }
      return { displaySymbol, providerSymbol };
    }

    const providerSymbol = DEFAULT_PROVIDER_SYMBOLS[item];
    if (!providerSymbol) {
      throw new Error(`Unknown symbol mapping for ${item}. Use DISPLAY=PROVIDER format.`);
    }
    return { displaySymbol: item, providerSymbol };
  });
}

async function fetchQuote(providerSymbol: string, env: Env) {
  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", providerSymbol);
  url.searchParams.set("token", env.FINNHUB_API_KEY);

  const response = await fetch(url.toString(), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Finnhub request failed for ${providerSymbol}: ${response.status}`);
  }

  const payload = (await response.json()) as QuoteResponse;
  if (typeof payload.c !== "number" || payload.c <= 0) {
    throw new Error(`Finnhub returned no current price for ${providerSymbol}`);
  }

  return payload;
}

async function ingestPrices(env: Env) {
  const symbols = parseSymbolConfig(env.POLL_SYMBOLS);
  const spreadBps = parseSpreadBps(env.ESTIMATED_SPREAD_BPS);

  const quotes = await Promise.all(
    symbols.map(async ({ displaySymbol, providerSymbol }) => {
      const payload = await fetchQuote(providerSymbol, env);
      const midPrice = payload.c as number;
      const spread = midPrice * (spreadBps / 10_000);

      return {
        symbol: displaySymbol,
        midPrice,
        bidPrice: midPrice - spread / 2,
        askPrice: midPrice + spread / 2,
        source: "finnhub",
        isEstimatedBidAsk: true,
        providerTimestampMs: typeof payload.t === "number" ? payload.t * 1000 : null,
      };
    }),
  );

  const response = await fetch(new URL("/api/mutation", env.CONVEX_URL).toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      path: "prices:ingestLatestBatch",
      format: "json",
      args: {
        secret: env.PRICE_INGEST_SECRET,
        quotes,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Convex ingest failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as
    | { status: "success"; value: unknown }
    | { status: "error"; errorMessage: string };
  if (payload.status !== "success") {
    throw new Error(`Convex ingest failed: ${payload.errorMessage}`);
  }

  return { count: quotes.length };
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(ingestPrices(env));
  },

  async fetch(_request: Request, env: Env) {
    try {
      const result = await ingestPrices(env);
      return Response.json({ ok: true, ...result });
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 },
      );
    }
  },
};
