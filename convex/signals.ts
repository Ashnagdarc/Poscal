import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));

const signalShape = {
  externalId: nullableStringArg,
  currencyPair: v.string(),
  symbol: nullableStringArg,
  direction: v.union(v.literal("buy"), v.literal("sell")),
  marketExecution: nullableStringArg,
  entryPrice: v.number(),
  stopLoss: v.number(),
  takeProfit1: v.number(),
  takeProfit2: nullableNumberArg,
  takeProfit3: nullableNumberArg,
  takeProfit: nullableNumberArg,
  pipsToSl: v.number(),
  pipsToTp1: v.number(),
  pipsToTp2: nullableNumberArg,
  pipsToTp3: nullableNumberArg,
  analysis: nullableStringArg,
  timeframe: nullableStringArg,
  expiresAtMs: nullableNumberArg,
  status: v.union(v.literal("active"), v.literal("closed"), v.literal("cancelled"), v.literal("expired")),
  result: v.optional(v.union(v.literal("win"), v.literal("loss"), v.literal("breakeven"), v.null())),
  tp1Hit: v.boolean(),
  tp2Hit: v.boolean(),
  tp3Hit: v.boolean(),
  notes: nullableStringArg,
  chartImageUrl: nullableStringArg,
  confidenceScore: nullableNumberArg,
  takenCount: v.number(),
  closedAtMs: nullableNumberArg,
};

const isSameUtcDate = (timestampMs: number, isoDate: string) =>
  new Date(timestampMs).toISOString().slice(0, 10) === isoDate;

const toPublicSignal = (row: any) => ({
  id: row._id,
  currency_pair: row.currencyPair,
  symbol: row.symbol ?? null,
  direction: row.direction,
  market_execution: row.marketExecution ?? null,
  entry_price: row.entryPrice,
  stop_loss: row.stopLoss,
  take_profit_1: row.takeProfit1,
  take_profit_2: row.takeProfit2 ?? null,
  take_profit_3: row.takeProfit3 ?? null,
  take_profit: row.takeProfit ?? null,
  pips_to_sl: row.pipsToSl,
  pips_to_tp1: row.pipsToTp1,
  pips_to_tp2: row.pipsToTp2 ?? null,
  pips_to_tp3: row.pipsToTp3 ?? null,
  analysis: row.analysis ?? null,
  timeframe: row.timeframe ?? null,
  expires_at: row.expiresAtMs ? new Date(row.expiresAtMs).toISOString() : null,
  status: row.status,
  result: row.result ?? null,
  tp1_hit: row.tp1Hit,
  tp2_hit: row.tp2Hit,
  tp3_hit: row.tp3Hit,
  notes: row.notes ?? null,
  chart_image_url: row.chartImageUrl ?? null,
  confidence_score: row.confidenceScore ?? null,
  taken_count: row.takenCount,
  created_at: new Date(row.createdAtMs).toISOString(),
  updated_at: new Date(row.updatedAtMs).toISOString(),
  closed_at: row.closedAtMs ? new Date(row.closedAtMs).toISOString() : null,
});

const requireAdmin = async (ctx: any) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const profile = await ctx.db
    .query("profiles")
    .withIndex("by_external_user_id", (q: any) => q.eq("externalUserId", userId))
    .first();

  const role = profile?.role ?? user.role ?? "user";
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Admin access required");
  }

  return { userId, user, profile };
};

export const list = query({
  args: {
    status: nullableStringArg,
    currencyPair: nullableStringArg,
    result: nullableStringArg,
    date: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("signals")
      .withIndex("by_created")
      .order("desc")
      .collect();

    return rows
      .filter((row) => {
        if (args.status && args.status !== "all" && row.status !== args.status) {
          return false;
        }

        if (args.currencyPair && args.currencyPair !== "All Pairs" && row.currencyPair !== args.currencyPair) {
          return false;
        }

        if (args.result && args.result !== "all") {
          if (args.result === "null") {
            if (row.result !== null && row.result !== undefined) {
              return false;
            }
          } else if (row.result !== args.result) {
            return false;
          }
        }

        if (args.date && !isSameUtcDate(row.createdAtMs, args.date)) {
          return false;
        }

        return true;
      })
      .map(toPublicSignal);
  },
});

export const create = mutation({
  args: signalShape,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("signals", {
      ...args,
      externalId: args.externalId ?? null,
      symbol: args.symbol ?? null,
      marketExecution: args.marketExecution ?? null,
      takeProfit2: args.takeProfit2 ?? null,
      takeProfit3: args.takeProfit3 ?? null,
      takeProfit: args.takeProfit ?? null,
      pipsToTp2: args.pipsToTp2 ?? null,
      pipsToTp3: args.pipsToTp3 ?? null,
      analysis: args.analysis ?? null,
      timeframe: args.timeframe ?? null,
      expiresAtMs: args.expiresAtMs ?? null,
      result: args.result ?? null,
      notes: args.notes ?? null,
      chartImageUrl: args.chartImageUrl ?? null,
      confidenceScore: args.confidenceScore ?? null,
      closedAtMs: args.closedAtMs ?? null,
      createdAtMs: now,
      updatedAtMs: now,
    });

    return toPublicSignal(await ctx.db.get(id));
  },
});

export const update = mutation({
  args: {
    id: v.id("signals"),
    currencyPair: nullableStringArg,
    symbol: nullableStringArg,
    direction: v.optional(v.union(v.literal("buy"), v.literal("sell"))),
    marketExecution: nullableStringArg,
    entryPrice: nullableNumberArg,
    stopLoss: nullableNumberArg,
    takeProfit1: nullableNumberArg,
    takeProfit2: nullableNumberArg,
    takeProfit3: nullableNumberArg,
    takeProfit: nullableNumberArg,
    pipsToSl: nullableNumberArg,
    pipsToTp1: nullableNumberArg,
    pipsToTp2: nullableNumberArg,
    pipsToTp3: nullableNumberArg,
    analysis: nullableStringArg,
    timeframe: nullableStringArg,
    expiresAtMs: nullableNumberArg,
    status: v.optional(v.union(v.literal("active"), v.literal("closed"), v.literal("cancelled"), v.literal("expired"))),
    result: v.optional(v.union(v.literal("win"), v.literal("loss"), v.literal("breakeven"), v.null())),
    tp1Hit: v.optional(v.boolean()),
    tp2Hit: v.optional(v.boolean()),
    tp3Hit: v.optional(v.boolean()),
    notes: nullableStringArg,
    chartImageUrl: nullableStringArg,
    confidenceScore: nullableNumberArg,
    takenCount: v.optional(v.number()),
    closedAtMs: nullableNumberArg,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Signal not found");
    }

    const { id, ...rest } = args;
    await ctx.db.patch(id, {
      currencyPair: rest.currencyPair ?? existing.currencyPair,
      symbol: rest.symbol ?? existing.symbol ?? null,
      direction: rest.direction ?? existing.direction,
      marketExecution: rest.marketExecution ?? existing.marketExecution ?? null,
      entryPrice: rest.entryPrice ?? existing.entryPrice,
      stopLoss: rest.stopLoss ?? existing.stopLoss,
      takeProfit1: rest.takeProfit1 ?? existing.takeProfit1,
      takeProfit2: rest.takeProfit2 ?? existing.takeProfit2 ?? null,
      takeProfit3: rest.takeProfit3 ?? existing.takeProfit3 ?? null,
      takeProfit: rest.takeProfit ?? existing.takeProfit ?? null,
      pipsToSl: rest.pipsToSl ?? existing.pipsToSl,
      pipsToTp1: rest.pipsToTp1 ?? existing.pipsToTp1,
      pipsToTp2: rest.pipsToTp2 ?? existing.pipsToTp2 ?? null,
      pipsToTp3: rest.pipsToTp3 ?? existing.pipsToTp3 ?? null,
      analysis: rest.analysis ?? existing.analysis ?? null,
      timeframe: rest.timeframe ?? existing.timeframe ?? null,
      expiresAtMs: rest.expiresAtMs ?? existing.expiresAtMs ?? null,
      status: rest.status ?? existing.status,
      result: rest.result !== undefined ? rest.result : existing.result ?? null,
      tp1Hit: rest.tp1Hit ?? existing.tp1Hit,
      tp2Hit: rest.tp2Hit ?? existing.tp2Hit,
      tp3Hit: rest.tp3Hit ?? existing.tp3Hit,
      notes: rest.notes ?? existing.notes ?? null,
      chartImageUrl: rest.chartImageUrl ?? existing.chartImageUrl ?? null,
      confidenceScore: rest.confidenceScore ?? existing.confidenceScore ?? null,
      takenCount: rest.takenCount ?? existing.takenCount,
      closedAtMs: rest.closedAtMs ?? existing.closedAtMs ?? null,
      updatedAtMs: Date.now(),
    });

    return toPublicSignal(await ctx.db.get(id));
  },
});

export const remove = mutation({
  args: {
    id: v.id("signals"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Signal not found");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
