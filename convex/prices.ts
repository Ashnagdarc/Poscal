import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const priceSnapshotArgs = {
  symbol: v.string(),
  bidPrice: v.optional(v.union(v.number(), v.null())),
  askPrice: v.optional(v.union(v.number(), v.null())),
  midPrice: v.number(),
  source: v.string(),
  isEstimatedBidAsk: v.boolean(),
  providerTimestampMs: v.optional(v.union(v.number(), v.null())),
};

type PriceSnapshotArgs = {
  symbol: string;
  bidPrice?: number | null;
  askPrice?: number | null;
  midPrice: number;
  source: string;
  isEstimatedBidAsk: boolean;
  providerTimestampMs?: number | null;
};

async function upsertPriceSnapshot(ctx: { db: any }, args: PriceSnapshotArgs) {
  const existing = await ctx.db
    .query("priceSnapshots")
    .withIndex("by_symbol", (q) => q.eq("symbol", args.symbol))
    .unique();

  const row = {
    symbol: args.symbol,
    bidPrice: args.bidPrice ?? null,
    askPrice: args.askPrice ?? null,
    midPrice: args.midPrice,
    source: args.source,
    isEstimatedBidAsk: args.isEstimatedBidAsk,
    providerTimestampMs: args.providerTimestampMs ?? null,
    updatedAtMs: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, row);
    return existing._id;
  }

  return await ctx.db.insert("priceSnapshots", row);
}

export const listLatest = query({
  args: {
    symbols: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    if (!args.symbols?.length) {
      return await ctx.db.query("priceSnapshots").collect();
    }

    const rows = await Promise.all(
      args.symbols.map(async (symbol) => {
        return await ctx.db
          .query("priceSnapshots")
          .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
          .unique();
      }),
    );

    return rows.filter((row) => row !== null);
  },
});

export const upsertLatest = mutation({
  args: priceSnapshotArgs,
  handler: async (ctx, args) => upsertPriceSnapshot(ctx, args),
});

export const ingestLatestBatch = mutation({
  args: {
    secret: v.string(),
    quotes: v.array(v.object(priceSnapshotArgs)),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.PRICE_INGEST_SECRET;
    if (!expectedSecret) {
      throw new Error("PRICE_INGEST_SECRET is not configured.");
    }

    if (args.secret !== expectedSecret) {
      throw new Error("Unauthorized");
    }

    const ids = [];
    for (const quote of args.quotes) {
      ids.push(await upsertPriceSnapshot(ctx, quote));
    }
    return ids;
  },
});

export const upsertLatestBatch = internalMutation({
  args: {
    quotes: v.array(v.object(priceSnapshotArgs)),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const quote of args.quotes) {
      ids.push(await upsertPriceSnapshot(ctx, quote));
    }
    return ids;
  },
});
