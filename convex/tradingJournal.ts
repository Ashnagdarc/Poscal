import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));
const nullableAnyArg = v.optional(v.union(v.any(), v.null()));

export const listForUser = query({
  args: {
    userId: v.string(),
    status: nullableStringArg,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_created", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit ?? 200);

    if (!args.status || args.status === "all") {
      return rows;
    }

    return rows.filter((row) => row.status === args.status);
  },
});

export const createEntry = mutation({
  args: {
    userId: v.string(),
    externalId: nullableStringArg,
    pair: v.string(),
    direction: v.union(v.literal("buy"), v.literal("sell"), v.literal("long"), v.literal("short")),
    entryPrice: nullableNumberArg,
    exitPrice: nullableNumberArg,
    stopLoss: nullableNumberArg,
    takeProfit: nullableNumberArg,
    riskPercent: nullableNumberArg,
    riskAmount: nullableNumberArg,
    positionSize: nullableNumberArg,
    pnl: nullableNumberArg,
    pnlPercent: nullableNumberArg,
    status: v.union(v.literal("open"), v.literal("closed"), v.literal("cancelled")),
    notes: nullableStringArg,
    journalType: nullableStringArg,
    richContent: nullableAnyArg,
    images: nullableAnyArg,
    links: nullableAnyArg,
    screenshots: nullableAnyArg,
    marketCondition: nullableStringArg,
    tags: nullableStringArg,
    entryDateMs: nullableNumberArg,
    exitDateMs: nullableNumberArg,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const insertedId = await ctx.db.insert("tradingJournal", {
      ...args,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return await ctx.db.get(insertedId);
  },
});

export const updateEntry = mutation({
  args: {
    id: v.id("tradingJournal"),
    userId: v.string(),
    pair: nullableStringArg,
    direction: v.optional(v.union(v.literal("buy"), v.literal("sell"), v.literal("long"), v.literal("short"))),
    entryPrice: nullableNumberArg,
    exitPrice: nullableNumberArg,
    stopLoss: nullableNumberArg,
    takeProfit: nullableNumberArg,
    riskPercent: nullableNumberArg,
    riskAmount: nullableNumberArg,
    positionSize: nullableNumberArg,
    pnl: nullableNumberArg,
    pnlPercent: nullableNumberArg,
    status: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("cancelled"))),
    notes: nullableStringArg,
    journalType: nullableStringArg,
    richContent: nullableAnyArg,
    images: nullableAnyArg,
    links: nullableAnyArg,
    screenshots: nullableAnyArg,
    marketCondition: nullableStringArg,
    tags: nullableStringArg,
    entryDateMs: nullableNumberArg,
    exitDateMs: nullableNumberArg,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== args.userId) {
      throw new Error("Journal entry not found");
    }

    const { id, userId, ...rest } = args;
    await ctx.db.patch(id, {
      ...rest,
      pair: rest.pair ?? existing.pair,
      direction: rest.direction ?? existing.direction,
      status: rest.status ?? existing.status,
      updatedAtMs: Date.now(),
    });

    return await ctx.db.get(id);
  },
});

export const deleteEntry = mutation({
  args: {
    id: v.id("tradingJournal"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== args.userId) {
      throw new Error("Journal entry not found");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const saveMany = mutation({
  args: {
    items: v.array(v.object({
      userId: v.string(),
      externalId: nullableStringArg,
      pair: v.string(),
      direction: v.union(v.literal("buy"), v.literal("sell"), v.literal("long"), v.literal("short")),
      entryPrice: nullableNumberArg,
      exitPrice: nullableNumberArg,
      stopLoss: nullableNumberArg,
      takeProfit: nullableNumberArg,
      riskPercent: nullableNumberArg,
      riskAmount: nullableNumberArg,
      positionSize: nullableNumberArg,
      pnl: nullableNumberArg,
      pnlPercent: nullableNumberArg,
      status: v.union(v.literal("open"), v.literal("closed"), v.literal("cancelled")),
      notes: nullableStringArg,
      journalType: nullableStringArg,
      richContent: nullableAnyArg,
      images: nullableAnyArg,
      links: nullableAnyArg,
      screenshots: nullableAnyArg,
      marketCondition: nullableStringArg,
      tags: nullableStringArg,
      entryDateMs: nullableNumberArg,
      exitDateMs: nullableNumberArg,
    })),
  },
  handler: async (ctx, args) => {
    const ids = [];
    const now = Date.now();

    for (const item of args.items) {
      ids.push(await ctx.db.insert("tradingJournal", {
        ...item,
        createdAtMs: now,
        updatedAtMs: now,
      }));
    }

    return ids;
  },
});
