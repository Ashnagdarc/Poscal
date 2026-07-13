import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));

const orderTypeArg = v.union(
  v.literal("buy"),
  v.literal("sell"),
  v.literal("buy_limit"),
  v.literal("sell_limit"),
  v.literal("buy_stop"),
  v.literal("sell_stop"),
);

const signalStatusArg = v.union(
  v.literal("active"),
  v.literal("hit_tp"),
  v.literal("hit_sl"),
  v.literal("cancelled"),
);

const signalShape = {
  currencyPair: v.string(),
  orderType: orderTypeArg,
  entryPrice: nullableNumberArg,
  stopLoss: v.number(),
  takeProfit1: v.number(),
  takeProfit2: nullableNumberArg,
  takeProfit3: nullableNumberArg,
  notes: nullableStringArg,
  tradingViewUrl: nullableStringArg,
  chartImageUrl: nullableStringArg,
  status: v.optional(signalStatusArg),
};

const isSameUtcDate = (timestampMs: number, isoDate: string) =>
  new Date(timestampMs).toISOString().slice(0, 10) === isoDate;

const getDirectionFromOrderType = (orderType: string): "buy" | "sell" =>
  orderType.startsWith("sell") ? "sell" : "buy";

const toLegacyMarketExecution = (orderType: string) => {
  if (orderType === "buy" || orderType === "sell") return "instant";
  return orderType.replace("_", "-");
};

const fromLegacyMarketExecution = (value: string | null | undefined, direction: "buy" | "sell") => {
  if (!value || value === "instant") return direction;
  const normalized = value.replace(/-/g, "_");
  if (
    normalized === "buy_limit" ||
    normalized === "sell_limit" ||
    normalized === "buy_stop" ||
    normalized === "sell_stop"
  ) {
    return normalized;
  }
  return direction;
};

const toPublicStatus = (row: any) => {
  if (row.status === "hit_tp" || row.status === "hit_sl" || row.status === "cancelled" || row.status === "active") {
    return row.status;
  }

  if (row.status === "closed") {
    if (row.result === "loss") return "hit_sl";
    if (row.result === "win") return "hit_tp";
  }

  return row.status === "cancelled" ? "cancelled" : "active";
};

const toPublicSignal = (row: any) => ({
  id: row._id,
  currency_pair: row.currencyPair,
  symbol: row.symbol ?? null,
  order_type: row.orderType ?? fromLegacyMarketExecution(row.marketExecution, row.direction),
  direction: row.direction,
  market_execution: row.marketExecution ?? null,
  entry_price: row.entryPrice,
  stop_loss: row.stopLoss,
  take_profit_1: row.takeProfit1,
  take_profit_2: row.takeProfit2 ?? null,
  take_profit_3: row.takeProfit3 ?? null,
  take_profit: row.takeProfit ?? null,
  status: toPublicStatus(row),
  notes: row.notes ?? null,
  trading_view_url: row.tradingViewUrl ?? null,
  chart_image_url: row.chartImageUrl ?? null,
  created_at: new Date(row.createdAtMs).toISOString(),
  updated_at: new Date(row.updatedAtMs).toISOString(),
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
        if (args.status && args.status !== "all" && toPublicStatus(row) !== args.status) {
          return false;
        }

        if (args.currencyPair && args.currencyPair !== "All Pairs" && row.currencyPair !== args.currencyPair) {
          return false;
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
    const direction = getDirectionFromOrderType(args.orderType);

    const id = await ctx.db.insert("signals", {
      currencyPair: args.currencyPair,
      symbol: args.currencyPair,
      orderType: args.orderType,
      direction,
      marketExecution: toLegacyMarketExecution(args.orderType),
      entryPrice: args.entryPrice ?? null,
      stopLoss: args.stopLoss,
      takeProfit1: args.takeProfit1,
      takeProfit2: args.takeProfit2 ?? null,
      takeProfit3: args.takeProfit3 ?? null,
      takeProfit: args.takeProfit1,
      pipsToSl: 0,
      pipsToTp1: 0,
      pipsToTp2: null,
      pipsToTp3: null,
      status: args.status ?? "active",
      externalId: null,
      analysis: null,
      timeframe: null,
      expiresAtMs: null,
      result: null,
      tp1Hit: false,
      tp2Hit: false,
      tp3Hit: false,
      notes: args.notes ?? null,
      tradingViewUrl: args.tradingViewUrl ?? null,
      chartImageUrl: args.chartImageUrl ?? null,
      confidenceScore: null,
      takenCount: 0,
      closedAtMs: null,
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
    orderType: v.optional(orderTypeArg),
    entryPrice: nullableNumberArg,
    stopLoss: nullableNumberArg,
    takeProfit1: nullableNumberArg,
    takeProfit2: nullableNumberArg,
    takeProfit3: nullableNumberArg,
    status: v.optional(signalStatusArg),
    notes: nullableStringArg,
    tradingViewUrl: nullableStringArg,
    chartImageUrl: nullableStringArg,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Signal not found");
    }

    const { id, ...rest } = args;
    const hasPatchValue = (key: string) => Object.prototype.hasOwnProperty.call(rest, key);
    const orderType = rest.orderType ?? existing.orderType ?? fromLegacyMarketExecution(existing.marketExecution, existing.direction);
    const direction = getDirectionFromOrderType(orderType);
    await ctx.db.patch(id, {
      currencyPair: rest.currencyPair ?? existing.currencyPair,
      symbol: rest.currencyPair ?? existing.symbol ?? null,
      orderType,
      direction,
      marketExecution: toLegacyMarketExecution(orderType),
      entryPrice: hasPatchValue("entryPrice") ? rest.entryPrice ?? null : existing.entryPrice ?? null,
      stopLoss: rest.stopLoss ?? existing.stopLoss,
      takeProfit1: rest.takeProfit1 ?? existing.takeProfit1,
      takeProfit2: hasPatchValue("takeProfit2") ? rest.takeProfit2 ?? null : existing.takeProfit2 ?? null,
      takeProfit3: hasPatchValue("takeProfit3") ? rest.takeProfit3 ?? null : existing.takeProfit3 ?? null,
      takeProfit: rest.takeProfit1 ?? existing.takeProfit ?? null,
      status: rest.status ?? existing.status,
      notes: hasPatchValue("notes") ? rest.notes ?? null : existing.notes ?? null,
      tradingViewUrl: hasPatchValue("tradingViewUrl") ? rest.tradingViewUrl ?? null : existing.tradingViewUrl ?? null,
      chartImageUrl: hasPatchValue("chartImageUrl") ? rest.chartImageUrl ?? null : existing.chartImageUrl ?? null,
      closedAtMs: rest.status && rest.status !== "active" ? Date.now() : existing.closedAtMs ?? null,
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
