type Env = {
  CONVEX_URL: string;
  CONVEX_SITE_URL?: string;
  FINNHUB_API_KEY: string;
  NOTIFICATION_WORKER_SECRET?: string;
  PRICE_INGEST_SECRET: string;
  WORKER_TRIGGER_SECRET?: string;
  POLL_SYMBOLS?: string;
  ESTIMATED_SPREAD_BPS?: string;
};

type ScheduledController = {
  scheduledTime: number;
  cron: string;
};

type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
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

  const quoteResults = await Promise.allSettled(
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

  const quotes = quoteResults
    .filter((result): result is PromiseFulfilledResult<{
      symbol: string;
      midPrice: number;
      bidPrice: number;
      askPrice: number;
      source: string;
      isEstimatedBidAsk: boolean;
      providerTimestampMs: number | null;
    }> => result.status === "fulfilled")
    .map((result) => result.value);

  const errors = quoteResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : "Unknown provider error");

  if (quotes.length === 0) {
    throw new Error(errors[0] ?? "No quotes fetched");
  }

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

  return { count: quotes.length, failedCount: errors.length, errors };
}

function getConvexSiteUrl(env: Env) {
  if (env.CONVEX_SITE_URL) {
    return env.CONVEX_SITE_URL;
  }
  return env.CONVEX_URL.replace(".convex.cloud", ".convex.site");
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

async function processNotifications(env: Env) {
  if (!env.NOTIFICATION_WORKER_SECRET) {
    return { skipped: true, reason: "NOTIFICATION_WORKER_SECRET is not configured" };
  }

  const response = await fetch(new URL("/notifications/process", getConvexSiteUrl(env)).toString(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.NOTIFICATION_WORKER_SECRET}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Convex notification processing failed: ${response.status} ${body}`);
  }

  return await response.json();
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      Promise.allSettled([ingestPrices(env), processNotifications(env)]).then((results) => {
        const rejected = results.find((result) => result.status === "rejected");
        if (rejected?.status === "rejected") {
          throw rejected.reason;
        }
      }),
    );
  },

  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (request.method === "GET") {
      return Response.json({
        ok: true,
        worker: "poscal-market-data",
        mode: "health",
        cron: "*/5 * * * *",
        symbols: parseSymbolConfig(env.POLL_SYMBOLS).map((item) => item.displaySymbol),
        notificationsEnabled: Boolean(env.NOTIFICATION_WORKER_SECRET),
      });
    }

    if (request.method !== "POST") {
      return Response.json(
        { ok: false, error: "Method not allowed" },
        { status: 405 },
      );
    }

    const expectedSecret = env.WORKER_TRIGGER_SECRET;
    const providedSecret = getBearerToken(request) ?? request.headers.get("x-worker-trigger-secret");

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    try {
      const [priceResult, notificationResult] = await Promise.all([
        ingestPrices(env),
        processNotifications(env),
      ]);
      return Response.json({
        ok: true,
        mode: "manual-trigger",
        path: url.pathname,
        prices: priceResult,
        notifications: notificationResult,
      });
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 },
      );
    }
  },
};
