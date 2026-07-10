import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
  args: {
    symbol: v.string(),
    bidPrice: v.optional(v.union(v.number(), v.null())),
    askPrice: v.optional(v.union(v.number(), v.null())),
    midPrice: v.number(),
    source: v.string(),
    isEstimatedBidAsk: v.boolean(),
    providerTimestampMs: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
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
  },
});
