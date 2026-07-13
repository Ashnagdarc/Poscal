import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const historyFields = {
  userId: v.string(),
  clientId: v.optional(v.union(v.string(), v.null())),
  pair: v.string(),
  direction: v.union(v.literal("buy"), v.literal("sell")),
  accountBalance: v.number(),
  riskPercent: v.number(),
  stopLossPips: v.number(),
  takeProfitPips: v.optional(v.union(v.number(), v.null())),
  riskAmount: v.number(),
  positionSize: v.number(),
  units: v.number(),
  pipValue: v.number(),
  spreadPips: v.optional(v.union(v.number(), v.null())),
  priceSource: v.string(),
  createdAtMs: v.number(),
};

export const listForUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("calculatorHistory")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const save = mutation({
  args: historyFields,
  handler: async (ctx, args) => {
    const existing = args.clientId
      ? await ctx.db
          .query("calculatorHistory")
          .withIndex("by_user_client", (q) => q.eq("userId", args.userId).eq("clientId", args.clientId ?? null))
          .unique()
      : null;

    const row = {
      userId: args.userId,
      clientId: args.clientId ?? null,
      pair: args.pair,
      direction: args.direction,
      accountBalance: args.accountBalance,
      riskPercent: args.riskPercent,
      stopLossPips: args.stopLossPips,
      takeProfitPips: args.takeProfitPips ?? null,
      riskAmount: args.riskAmount,
      positionSize: args.positionSize,
      units: args.units,
      pipValue: args.pipValue,
      spreadPips: args.spreadPips ?? null,
      priceSource: args.priceSource,
      createdAtMs: args.createdAtMs,
    };

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return existing._id;
    }

    return await ctx.db.insert("calculatorHistory", row);
  },
});

export const saveMany = mutation({
  args: {
    items: v.array(v.object(historyFields)),
  },
  handler: async (ctx, args) => {
    const ids = [];

    for (const item of args.items) {
      const existing = item.clientId
        ? await ctx.db
            .query("calculatorHistory")
            .withIndex("by_user_client", (q) => q.eq("userId", item.userId).eq("clientId", item.clientId ?? null))
            .unique()
        : null;

      const row = {
        userId: item.userId,
        clientId: item.clientId ?? null,
        pair: item.pair,
        direction: item.direction,
        accountBalance: item.accountBalance,
        riskPercent: item.riskPercent,
        stopLossPips: item.stopLossPips,
        takeProfitPips: item.takeProfitPips ?? null,
        riskAmount: item.riskAmount,
        positionSize: item.positionSize,
        units: item.units,
        pipValue: item.pipValue,
        spreadPips: item.spreadPips ?? null,
        priceSource: item.priceSource,
        createdAtMs: item.createdAtMs,
      };

      if (existing) {
        await ctx.db.patch(existing._id, row);
        ids.push(existing._id);
      } else {
        ids.push(await ctx.db.insert("calculatorHistory", row));
      }
    }

    return ids;
  },
});

export const clearForUser = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("calculatorHistory")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .collect();

    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));

    return { deleted: rows.length };
  },
});
