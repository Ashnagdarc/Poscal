import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

type IncomingQuote = {
  symbol: string;
  bidPrice?: number | null;
  askPrice?: number | null;
  midPrice: number;
  source?: string;
  isEstimatedBidAsk?: boolean;
  providerTimestampMs?: number | null;
};

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

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeQuotes(quotes: unknown): IncomingQuote[] | null {
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return null;
  }

  const normalized: IncomingQuote[] = [];

  for (const quote of quotes) {
    if (!quote || typeof quote !== "object") {
      return null;
    }

    const candidate = quote as Record<string, unknown>;
    if (typeof candidate.symbol !== "string" || typeof candidate.midPrice !== "number") {
      return null;
    }

    normalized.push({
      symbol: candidate.symbol,
      bidPrice: typeof candidate.bidPrice === "number" ? candidate.bidPrice : null,
      askPrice: typeof candidate.askPrice === "number" ? candidate.askPrice : null,
      midPrice: candidate.midPrice,
      source: typeof candidate.source === "string" ? candidate.source : "finnhub",
      isEstimatedBidAsk: typeof candidate.isEstimatedBidAsk === "boolean" ? candidate.isEstimatedBidAsk : true,
      providerTimestampMs: typeof candidate.providerTimestampMs === "number" ? candidate.providerTimestampMs : null,
    });
  }

  return normalized;
}

export const ingestPrices = httpAction(async (ctx, request) => {
  const expectedSecret = process.env.PRICE_INGEST_SECRET;
  if (!expectedSecret) {
    return badRequest("PRICE_INGEST_SECRET is not configured.", 500);
  }

  const providedSecret = getBearerToken(request) ?? request.headers.get("x-price-ingest-secret");
  if (providedSecret !== expectedSecret) {
    return badRequest("Unauthorized", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const quotes = normalizeQuotes((payload as { quotes?: unknown })?.quotes);
  if (!quotes) {
    return badRequest("Body must contain a non-empty quotes array.");
  }

  await ctx.runMutation(internal.prices.upsertLatestBatch, { quotes });

  return new Response(JSON.stringify({ ok: true, count: quotes.length }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
