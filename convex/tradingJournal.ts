import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { getVerifiedAuthUserId, requireVerifiedAuthUserId } from "./lib/auth";
import { assertValidTradeFields } from "./lib/tradeValidation";
import {
  CLOSED_TRADE_ALERT_SCAN_LIMIT,
  evaluateEquityMilestone,
  evaluateRiskAlert,
  evaluateTradeCountMilestone,
} from "./lib/tradingAlerts";

type TradeStatus = "open" | "closed" | "cancelled";

const parseTradeStatusFilter = (status: string | null | undefined): TradeStatus | null => {
  if (!status || status === "all") return null;
  switch (status) {
    case "open":
    case "closed":
    case "cancelled":
      return status;
    default:
      return null;
  }
};

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));
const nullableAnyArg = v.optional(v.union(v.any(), v.null()));

const tradeCreateFields = {
  journalId: v.optional(v.union(v.id("tradingAccounts"), v.null())),
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
};

const assertJournalOwned = async (
  ctx: { db: any },
  userId: string,
  journalId: string | null | undefined,
) => {
  if (!journalId) return;
  const journal = await ctx.db.get(journalId);
  if (!journal || journal.userId !== userId) {
    throw new Error("Journal not found");
  }
};

const queueUserAlert = async (
  ctx: { db: any },
  args: {
    userId: string;
    title: string;
    body: string;
    tag: string;
    data: Record<string, unknown>;
    recipientEmail: string | null;
    preferPush: boolean;
  },
) => {
  const now = Date.now();
  const existing = await ctx.db
    .query("notificationQueue")
    .withIndex("by_user_created", (q: any) => q.eq("userId", args.userId))
    .order("desc")
    .take(40);

  if (existing.some((row: { tag?: string | null }) => row.tag === args.tag)) {
    return;
  }

  if (args.preferPush) {
    await ctx.db.insert("notificationQueue", {
      userId: args.userId,
      channel: "push",
      title: args.title,
      body: args.body,
      status: "pending",
      recipientEmail: null,
      tag: args.tag,
      data: args.data,
      scheduledForMs: null,
      processingStartedAtMs: null,
      attempts: 0,
      errorMessage: null,
      createdAtMs: now,
      updatedAtMs: now,
    });
  }

  if (args.recipientEmail) {
    await ctx.db.insert("notificationQueue", {
      userId: args.userId,
      channel: "email",
      title: args.title,
      body: args.body,
      status: "pending",
      recipientEmail: args.recipientEmail,
      tag: `${args.tag}-email`,
      data: args.data,
      scheduledForMs: null,
      processingStartedAtMs: null,
      attempts: 0,
      errorMessage: null,
      createdAtMs: now,
      updatedAtMs: now,
    });
  }
};

export const listForUser = query({
  args: {
    journalId: v.optional(v.union(v.id("tradingAccounts"), v.null())),
    status: nullableStringArg,
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const limit = Math.min(Math.max(args.limit ?? 200, 1), 500);
    const statusFilter = parseTradeStatusFilter(args.status);

    if (args.journalId) {
      await assertJournalOwned(ctx, userId, args.journalId);
      if (statusFilter) {
        return await ctx.db
          .query("tradingJournal")
          .withIndex("by_user_journal_status_created", (q) =>
            q
              .eq("userId", userId)
              .eq("journalId", args.journalId)
              .eq("status", statusFilter),
          )
          .order("desc")
          .take(limit);
      }
      return await ctx.db
        .query("tradingJournal")
        .withIndex("by_user_journal_created", (q) =>
          q.eq("userId", userId).eq("journalId", args.journalId),
        )
        .order("desc")
        .take(limit);
    }

    if (statusFilter) {
      return await ctx.db
        .query("tradingJournal")
        .withIndex("by_user_status_created", (q) =>
          q.eq("userId", userId).eq("status", statusFilter),
        )
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/** Evaluate risk / milestone alerts after a trade write (P-030). */
export const evaluateTradeAlerts = internalMutation({
  args: {
    userId: v.string(),
    tradeId: v.id("tradingJournal"),
    previousPnl: nullableNumberArg,
    previousStatus: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const trade = await ctx.db.get(args.tradeId);
    if (!trade || trade.userId !== args.userId) {
      return { queued: 0 };
    }

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();

    const riskAlertsEnabled = profile?.tradingRiskAlertsEnabled !== false;
    const milestoneAlertsEnabled = profile?.tradingMilestoneAlertsEnabled !== false;
    const defaultRisk = profile?.defaultRiskPercent ?? 1;
    const recipientEmail = profile?.email ?? null;

    const activePush = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    const preferPush = activePush.some((row) => row.isActive);

    let queued = 0;

    if (riskAlertsEnabled) {
      const riskAlert = evaluateRiskAlert(trade.riskPercent ?? null, defaultRisk);
      if (riskAlert) {
        await queueUserAlert(ctx, {
          userId: args.userId,
          title: riskAlert.title,
          body: riskAlert.body,
          tag: `risk-${args.tradeId}`,
          data: { type: "trading_risk", path: "/journal", tradeId: args.tradeId },
          recipientEmail,
          preferPush,
        });
        queued += 1;
      }
    }

    if (!milestoneAlertsEnabled) {
      return { queued };
    }

    const journalId = trade.journalId ?? null;
    // Indexed closed-trade scan (no full-journal collect). Cap documented in
    // CLOSED_TRADE_ALERT_SCAN_LIMIT — typical users stay well under it.
    const closedRows = journalId
      ? await ctx.db
          .query("tradingJournal")
          .withIndex("by_user_journal_status_created", (q) =>
            q
              .eq("userId", args.userId)
              .eq("journalId", journalId)
              .eq("status", "closed"),
          )
          .order("desc")
          .take(CLOSED_TRADE_ALERT_SCAN_LIMIT)
      : await ctx.db
          .query("tradingJournal")
          .withIndex("by_user_status_created", (q) =>
            q.eq("userId", args.userId).eq("status", "closed"),
          )
          .order("desc")
          .take(CLOSED_TRADE_ALERT_SCAN_LIMIT);

    const closedWithPnl = closedRows.filter(
      (row) =>
        row.pnl !== null
        && row.pnl !== undefined
        && Number.isFinite(row.pnl),
    );
    const closedCount = closedWithPnl.length;
    const nextTotalPnl = closedWithPnl.reduce((sum, row) => sum + (row.pnl as number), 0);

    const wasClosedWithPnl =
      args.previousStatus === "closed"
      && args.previousPnl !== null
      && args.previousPnl !== undefined
      && Number.isFinite(args.previousPnl);
    const previousTotalPnl = wasClosedWithPnl
      ? nextTotalPnl - (trade.pnl ?? 0) + (args.previousPnl as number)
      : nextTotalPnl - (
        trade.status === "closed" && trade.pnl != null && Number.isFinite(trade.pnl)
          ? trade.pnl
          : 0
      );

    const countAlert = evaluateTradeCountMilestone(closedCount);
    if (countAlert) {
      await queueUserAlert(ctx, {
        userId: args.userId,
        title: countAlert.title,
        body: countAlert.body,
        tag: `milestone-${countAlert.milestoneKey}-${args.userId}${journalId ? `-${journalId}` : ""}`,
        data: { type: "trading_milestone", path: "/journal", milestoneKey: countAlert.milestoneKey },
        recipientEmail,
        preferPush,
      });
      queued += 1;
    }

    let startingBalance = 0;
    if (journalId) {
      const journal = await ctx.db.get(journalId as Id<"tradingAccounts">);
      startingBalance = journal?.startingBalance ?? journal?.balance ?? 0;
    }

    const equityAlert = evaluateEquityMilestone(startingBalance, previousTotalPnl, nextTotalPnl);
    if (equityAlert) {
      await queueUserAlert(ctx, {
        userId: args.userId,
        title: equityAlert.title,
        body: equityAlert.body,
        tag: `milestone-${equityAlert.milestoneKey}-${args.userId}${journalId ? `-${journalId}` : ""}`,
        data: { type: "trading_milestone", path: "/journal", milestoneKey: equityAlert.milestoneKey },
        recipientEmail,
        preferPush,
      });
      queued += 1;
    }

    return { queued };
  },
});

export const createEntry = mutation({
  args: tradeCreateFields,
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    await assertJournalOwned(ctx, userId, args.journalId);
    assertValidTradeFields(args);

    const now = Date.now();
    const insertedId = await ctx.db.insert("tradingJournal", {
      ...args,
      userId,
      journalId: args.journalId ?? null,
      createdAtMs: now,
      updatedAtMs: now,
    });

    await ctx.scheduler.runAfter(0, internal.tradingJournal.evaluateTradeAlerts, {
      userId,
      tradeId: insertedId,
      previousPnl: null,
      previousStatus: null,
    });

    return await ctx.db.get(insertedId);
  },
});

export const updateEntry = mutation({
  args: {
    id: v.id("tradingJournal"),
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
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Journal entry not found");
    }

    const { id, ...rest } = args;
    const nextPair = rest.pair ?? existing.pair;
    const nextStatus = rest.status ?? existing.status;
    const nextDirection = rest.direction ?? existing.direction;

    assertValidTradeFields({
      pair: nextPair,
      direction: nextDirection,
      status: nextStatus,
      entryPrice: rest.entryPrice !== undefined ? rest.entryPrice : existing.entryPrice,
      exitPrice: rest.exitPrice !== undefined ? rest.exitPrice : existing.exitPrice,
      stopLoss: rest.stopLoss !== undefined ? rest.stopLoss : existing.stopLoss,
      takeProfit: rest.takeProfit !== undefined ? rest.takeProfit : existing.takeProfit,
      riskPercent: rest.riskPercent !== undefined ? rest.riskPercent : existing.riskPercent,
      riskAmount: rest.riskAmount !== undefined ? rest.riskAmount : existing.riskAmount,
      positionSize: rest.positionSize !== undefined ? rest.positionSize : existing.positionSize,
      pnl: rest.pnl !== undefined ? rest.pnl : existing.pnl,
      pnlPercent: rest.pnlPercent !== undefined ? rest.pnlPercent : existing.pnlPercent,
      notes: rest.notes !== undefined ? rest.notes : existing.notes,
    });

    await ctx.db.patch(id, {
      ...rest,
      pair: nextPair,
      direction: nextDirection,
      status: nextStatus,
      updatedAtMs: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.tradingJournal.evaluateTradeAlerts, {
      userId,
      tradeId: id,
      previousPnl: existing.pnl ?? null,
      previousStatus: existing.status,
    });

    return await ctx.db.get(id);
  },
});

export const deleteEntry = mutation({
  args: {
    id: v.id("tradingJournal"),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Journal entry not found");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const saveMany = mutation({
  args: {
    items: v.array(v.object(tradeCreateFields)),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    if (args.items.length > 100) {
      throw new Error("Batch too large (max 100 trades)");
    }
    const ids = [];
    const now = Date.now();

    for (const item of args.items) {
      await assertJournalOwned(ctx, userId, item.journalId);
      assertValidTradeFields(item);
      ids.push(await ctx.db.insert("tradingJournal", {
        ...item,
        userId,
        journalId: item.journalId ?? null,
        createdAtMs: now,
        updatedAtMs: now,
      }));
    }

    return ids;
  },
});
