import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));
const nullableStringArrayArg = v.optional(v.union(v.array(v.string()), v.null()));
const orderTypeArg = v.optional(v.union(
  v.literal("buy"),
  v.literal("sell"),
  v.literal("buy_limit"),
  v.literal("sell_limit"),
  v.literal("buy_stop"),
  v.literal("sell_stop"),
  v.null(),
));
const statusArg = v.optional(v.union(
  v.literal("open"),
  v.literal("win"),
  v.literal("loss"),
  v.literal("breakeven"),
  v.literal("cancelled"),
  v.null(),
));

const historyFields = {
  userId: v.string(),
  clientId: nullableStringArg,
  symbol: v.string(),
  orderType: orderTypeArg,
  entryPrice: nullableNumberArg,
  stopLossPrice: nullableNumberArg,
  takeProfitPrice: nullableNumberArg,
  accountBalance: v.number(),
  riskPercent: v.number(),
  stopLossPips: nullableNumberArg,
  takeProfitPips: nullableNumberArg,
  riskAmount: v.number(),
  lotSize: v.number(),
  actualRisk: nullableNumberArg,
  rewardToRisk: nullableNumberArg,
  potentialProfit: nullableNumberArg,
  source: v.union(v.literal("manual"), v.literal("signal")),
  signalId: nullableStringArg,
  status: statusArg,
  pnlAmount: nullableNumberArg,
  resultR: nullableNumberArg,
  note: nullableStringArg,
  screenshotUrls: nullableStringArrayArg,
  openedAtMs: nullableNumberArg,
  closedAtMs: nullableNumberArg,
  createdAtMs: v.number(),
  updatedAtMs: nullableNumberArg,
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
    const now = Date.now();
    const existing = args.clientId
      ? await ctx.db
          .query("calculatorHistory")
          .withIndex("by_user_client", (q) => q.eq("userId", args.userId).eq("clientId", args.clientId ?? null))
          .unique()
      : null;

    const row = {
      userId: args.userId,
      clientId: args.clientId ?? null,
      symbol: args.symbol,
      orderType: args.orderType ?? null,
      entryPrice: args.entryPrice ?? null,
      stopLossPrice: args.stopLossPrice ?? null,
      takeProfitPrice: args.takeProfitPrice ?? null,
      accountBalance: args.accountBalance,
      riskPercent: args.riskPercent,
      stopLossPips: args.stopLossPips ?? null,
      takeProfitPips: args.takeProfitPips ?? null,
      riskAmount: args.riskAmount,
      lotSize: args.lotSize,
      actualRisk: args.actualRisk ?? null,
      rewardToRisk: args.rewardToRisk ?? null,
      potentialProfit: args.potentialProfit ?? null,
      source: args.source,
      signalId: args.signalId ?? null,
      status: args.status ?? existing?.status ?? "open",
      pnlAmount: args.pnlAmount ?? existing?.pnlAmount ?? null,
      resultR: args.resultR ?? existing?.resultR ?? null,
      note: args.note ?? existing?.note ?? null,
      screenshotUrls: args.screenshotUrls ?? existing?.screenshotUrls ?? null,
      openedAtMs: args.openedAtMs ?? existing?.openedAtMs ?? args.createdAtMs,
      closedAtMs: args.closedAtMs ?? existing?.closedAtMs ?? null,
      createdAtMs: args.createdAtMs,
      updatedAtMs: args.updatedAtMs ?? now,
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
    const now = Date.now();

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
        symbol: item.symbol,
        orderType: item.orderType ?? null,
        entryPrice: item.entryPrice ?? null,
        stopLossPrice: item.stopLossPrice ?? null,
        takeProfitPrice: item.takeProfitPrice ?? null,
        accountBalance: item.accountBalance,
        riskPercent: item.riskPercent,
        stopLossPips: item.stopLossPips ?? null,
        takeProfitPips: item.takeProfitPips ?? null,
        riskAmount: item.riskAmount,
        lotSize: item.lotSize,
        actualRisk: item.actualRisk ?? null,
        rewardToRisk: item.rewardToRisk ?? null,
        potentialProfit: item.potentialProfit ?? null,
        source: item.source,
        signalId: item.signalId ?? null,
        status: item.status ?? existing?.status ?? "open",
        pnlAmount: item.pnlAmount ?? existing?.pnlAmount ?? null,
        resultR: item.resultR ?? existing?.resultR ?? null,
        note: item.note ?? existing?.note ?? null,
        screenshotUrls: item.screenshotUrls ?? existing?.screenshotUrls ?? null,
        openedAtMs: item.openedAtMs ?? existing?.openedAtMs ?? item.createdAtMs,
        closedAtMs: item.closedAtMs ?? existing?.closedAtMs ?? null,
        createdAtMs: item.createdAtMs,
        updatedAtMs: item.updatedAtMs ?? now,
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

export const remove = mutation({
  args: {
    userId: v.string(),
    clientId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("calculatorHistory")
      .withIndex("by_user_client", (q) => q.eq("userId", args.userId).eq("clientId", args.clientId))
      .unique();

    if (!existing) {
      return { deleted: false };
    }

    await ctx.db.delete(existing._id);
    return { deleted: true };
  },
});

export const backfillLegacyRows = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("calculatorHistory").collect();
    const limit = args.limit ?? rows.length;
    let scanned = 0;
    let patched = 0;
    let skipped = 0;

    for (const row of rows) {
      if (scanned >= limit) {
        break;
      }
      scanned += 1;

      const rawPair = typeof row.pair === "string" ? row.pair.trim() : "";
      const normalizedSymbol = rawPair.length > 0 ? rawPair : null;
      const normalizedOrderType =
        row.orderType ??
        (row.direction === "buy" || row.direction === "sell" ? row.direction : null);
      const normalizedLotSize =
        row.lotSize ??
        (typeof row.positionSize === "number" && Number.isFinite(row.positionSize)
          ? row.positionSize
          : null);
      const normalizedCreatedAtMs =
        typeof row.createdAtMs === "number" && row.createdAtMs > 0
          ? row.createdAtMs
          : row._creationTime;
      const normalizedOpenedAtMs = row.openedAtMs ?? normalizedCreatedAtMs ?? row._creationTime;
      const normalizedUpdatedAtMs = row.updatedAtMs ?? row._creationTime;
      const normalizedSource = row.source ?? "manual";
      const normalizedStatus = row.status ?? "open";

      const patch: Record<string, unknown> = {};

      if (row.symbol == null && normalizedSymbol) {
        patch.symbol = normalizedSymbol;
      }
      if (row.orderType == null && normalizedOrderType) {
        patch.orderType = normalizedOrderType;
      }
      if (row.lotSize == null && normalizedLotSize != null) {
        patch.lotSize = normalizedLotSize;
      }
      if ((row.createdAtMs ?? 0) <= 0 && normalizedCreatedAtMs != null) {
        patch.createdAtMs = normalizedCreatedAtMs;
      }
      if (row.openedAtMs == null && normalizedOpenedAtMs != null) {
        patch.openedAtMs = normalizedOpenedAtMs;
      }
      if (row.updatedAtMs == null && normalizedUpdatedAtMs != null) {
        patch.updatedAtMs = normalizedUpdatedAtMs;
      }
      if (row.source == null) {
        patch.source = normalizedSource;
      }
      if (row.status == null) {
        patch.status = normalizedStatus;
      }

      if (Object.keys(patch).length === 0) {
        skipped += 1;
        continue;
      }

      await ctx.db.patch(row._id, patch);
      patched += 1;
    }

    return {
      scanned,
      patched,
      skipped,
    };
  },
});
