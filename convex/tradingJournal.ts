import { assertEditableJournal, consumeEntryAllowance, getProAccess } from "./lib/proAccess";
import { paginationOptsValidator } from "convex/server";
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


const bumpJournalStatsVersion = async (
  ctx: { db: any },
  userId: string,
  journalId: Id<"tradingAccounts"> | null | undefined,
) => {
  if (!journalId) return;
  const journal = await ctx.db.get(journalId);
  if (!journal || journal.userId !== userId) {
    throw new Error("Journal not found");
  }
  const previousVersion = journal.statsVersion ?? 0;
  const nextVersion = previousVersion + 1;

  await ctx.db.patch(journalId, {
    statsVersion: nextVersion,
    updatedAtMs: Date.now(),
  });

  // The trade-facts projection is synchronized before this helper is called.
  // When its backfill is already complete for the previous version, advance
  // the checkpoint in the same mutation instead of rescanning the journal.
  const factsState = await ctx.db
    .query("journalTradeFactsBackfills")
    .withIndex("by_user_journal", (q: any) =>
      q.eq("userId", userId).eq("journalId", journalId),
    )
    .unique();

  if (
    factsState
    && factsState.status === "complete"
    && factsState.sourceVersion === previousVersion
  ) {
    await ctx.db.patch(factsState._id, {
      sourceVersion: nextVersion,
      updatedAtMs: Date.now(),
    });
  }
};

const syncTradeFact = async (
  ctx: { db: any },
  trade: {
    _id: Id<"tradingJournal">;
    userId: string;
    journalId?: Id<"tradingAccounts"> | null;
    status: "open" | "closed" | "cancelled";
    pair: string;
    journalType?: string | null;
    tags?: string | null;
    pnl?: number | null;
    exitDateMs?: number | null;
    entryDateMs?: number | null;
    createdAtMs: number;
  },
) => {
  const existing = await ctx.db
    .query("journalTradeFacts")
    .withIndex("by_trade", (q: any) => q.eq("tradeId", trade._id))
    .unique();

  if (
    !trade.journalId
    || trade.status !== "closed"
    || trade.journalType === "notebook_draft"
  ) {
    if (existing) await ctx.db.delete(existing._id);
    return;
  }

  const now = Date.now();
  const payload = {
    userId: trade.userId,
    journalId: trade.journalId,
    tradeId: trade._id,
    analyticsAtMs: trade.exitDateMs ?? trade.entryDateMs ?? trade.createdAtMs,
    pair: trade.pair,
    tags: trade.tags ?? null,
    pnl: trade.pnl ?? 0,
    updatedAtMs: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, payload);
  } else {
    await ctx.db.insert("journalTradeFacts", {
      ...payload,
      createdAtMs: now,
    });
  }
};

const removeTradeFact = async (
  ctx: { db: any },
  tradeId: Id<"tradingJournal">,
) => {
  const existing = await ctx.db
    .query("journalTradeFacts")
    .withIndex("by_trade", (q: any) => q.eq("tradeId", tradeId))
    .unique();
  if (existing) await ctx.db.delete(existing._id);
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

  const existingTags = new Set(
    existing.map((row: { tag?: string | null }) => row.tag).filter((tag: string | null | undefined) => Boolean(tag)),
  );

  if (args.preferPush) {
    const subs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_user_active", (q: any) => q.eq("userId", args.userId).eq("isActive", true))
      .take(20);
    for (const sub of subs) {
      const tag = `${args.tag}-push-${sub._id}`;
      if (existingTags.has(tag)) continue;
      await ctx.db.insert("notificationQueue", {
        userId: args.userId,
        channel: "push",
        title: args.title,
        body: args.body,
        status: "pending",
        recipientEmail: null,
        tag,
        data: { ...args.data, subscriptionId: sub._id, displayTag: args.tag },
        scheduledForMs: null,
        processingStartedAtMs: null,
        attempts: 0,
        errorMessage: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
    }
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

const NOTEBOOK_SECTION_MAX_CHARS = 100_000;
const NOTEBOOK_TITLE_MAX_CHARS = 120;

const normalizeNotebookTitle = (value: string | null | undefined) => {
  if (value == null) return null;
  const normalized = value.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (normalized.length > NOTEBOOK_TITLE_MAX_CHARS) {
    throw new Error(`Notebook title is too long (max ${NOTEBOOK_TITLE_MAX_CHARS} characters)`);
  }
  return normalized || null;
};

const normalizeNotebookText = (value: string | null | undefined) => {
  if (value == null) return null;
  const normalized = value.replace(/\r\n/g, "\n");
  if (normalized.length > NOTEBOOK_SECTION_MAX_CHARS) {
    throw new Error(`Notebook section is too long (max ${NOTEBOOK_SECTION_MAX_CHARS.toLocaleString()} characters)`);
  }
  return normalized.trim() ? normalized : null;
};

const deriveJournalStatus = (fields: {
  entryReason?: string | null;
  duringTradeNotes?: string | null;
  postTradeReview?: string | null;
  lessonsLearned?: string | null;
}) => {
  const values = [
    fields.entryReason,
    fields.duringTradeNotes,
    fields.postTradeReview,
    fields.lessonsLearned,
  ];
  const filled = values.filter((value) => Boolean(value?.trim())).length;
  if (filled === 0) return "empty" as const;
  if (filled === values.length) return "complete" as const;
  return "draft" as const;
};

export const getById = query({
  args: {
    id: v.id("tradingJournal"),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return null;

    const trade = await ctx.db.get(args.id);
    if (!trade || trade.userId !== userId) {
      return null;
    }

    if (trade.journalId) {
      await assertJournalOwned(ctx, userId, trade.journalId);
    }

    return trade;
  },
});

export const getNotebookByTrade = query({
  args: {
    id: v.id("tradingJournal"),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return null;

    const trade = await ctx.db.get(args.id);
    if (!trade || trade.userId !== userId) {
      return null;
    }
    if (trade.journalId) {
      await assertJournalOwned(ctx, userId, trade.journalId);
    }

    const notebook = await ctx.db
      .query("tradeNotebooks")
      .withIndex("by_trade", (q) => q.eq("tradeId", args.id))
      .unique();

    if (notebook && notebook.userId !== userId) {
      throw new Error("Notebook ownership mismatch");
    }

    return { trade, notebook };
  },
});

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


/**
 * Cursor-paginated trade feed for large journals.
 * Kept alongside listForUser so existing analytics remain unchanged during migration.
 */
export const listForUserPaginated = query({
  args: {
    journalId: v.optional(v.union(v.id("tradingAccounts"), v.null())),
    status: nullableStringArg,
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

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
          .paginate(args.paginationOpts);
      }

      return await ctx.db
        .query("tradingJournal")
        .withIndex("by_user_journal_created", (q) =>
          q.eq("userId", userId).eq("journalId", args.journalId),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    if (statusFilter) {
      return await ctx.db
        .query("tradingJournal")
        .withIndex("by_user_status_created", (q) =>
          q.eq("userId", userId).eq("status", statusFilter),
        )
        .order("desc")
        .paginate(args.paginationOpts);
    }

    return await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(args.paginationOpts);
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

export const createNotebookDraft = mutation({
  args: {
    journalId: v.id("tradingAccounts"),
    entryDateMs: nullableNumberArg,
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    await assertJournalOwned(ctx, userId, args.journalId);

    await consumeEntryAllowance(ctx, userId, args.journalId);
    const now = Date.now();
    const insertedId = await ctx.db.insert("tradingJournal", {
      userId,
      journalId: args.journalId,
      externalId: null,
      pair: "JOURNAL",
      direction: "long",
      entryPrice: null,
      exitPrice: null,
      stopLoss: null,
      takeProfit: null,
      riskPercent: null,
      riskAmount: null,
      positionSize: null,
      pnl: null,
      pnlPercent: null,
      status: "open",
      notes: null,
      journalType: "notebook_draft",
      journalTitle: null,
      richContent: null,
      journalStatus: "empty",
      journalPreview: null,
      journalUpdatedAtMs: null,
      images: null,
      links: null,
      screenshots: null,
      marketCondition: null,
      tags: null,
      entryDateMs: args.entryDateMs ?? now,
      exitDateMs: null,
      createdAtMs: now,
      updatedAtMs: now,
    });

    // Notebook drafts deliberately do not touch trade facts, statsVersion, or
    // trading alerts. They become a real analytics trade only when the user
    // adds structured trade details.
    return await ctx.db.get(insertedId);
  },
});

export const createEntry = mutation({
  args: tradeCreateFields,
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    await assertJournalOwned(ctx, userId, args.journalId);
    assertValidTradeFields(args);

    await consumeEntryAllowance(ctx, userId, args.journalId);
    const now = Date.now();
    const insertedId = await ctx.db.insert("tradingJournal", {
      ...args,
      userId,
      journalId: args.journalId ?? null,
      createdAtMs: now,
      updatedAtMs: now,
    });

    const insertedTrade = await ctx.db.get(insertedId);
    if (insertedTrade) {
      await syncTradeFact(ctx, insertedTrade);
    }
    await bumpJournalStatsVersion(ctx, userId, args.journalId ?? null);

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
    if (existing.deletionRequestedAtMs) {
      throw new Error("Journal entry is being deleted");
    }

    await assertEditableJournal(ctx, userId, existing.journalId);
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

    const updatedTrade = await ctx.db.get(id);
    if (updatedTrade) {
      await syncTradeFact(ctx, updatedTrade);

      const draftStateChanged =
        (existing.journalType === "notebook_draft")
        !== (updatedTrade.journalType === "notebook_draft");
      const statsChanged =
        draftStateChanged
        || (
          updatedTrade.journalType !== "notebook_draft"
          && (
            updatedTrade.status !== existing.status
            || (updatedTrade.pnl ?? null) !== (existing.pnl ?? null)
            || (updatedTrade.riskAmount ?? null) !== (existing.riskAmount ?? null)
          )
        );

      if (statsChanged) {
        await bumpJournalStatsVersion(ctx, userId, existing.journalId ?? null);
      }
    }

    if (updatedTrade?.journalType !== "notebook_draft") {
      await ctx.scheduler.runAfter(0, internal.tradingJournal.evaluateTradeAlerts, {
        userId,
        tradeId: id,
        previousPnl: existing.pnl ?? null,
        previousStatus: existing.status,
      });
    }

    return await ctx.db.get(id);
  },
});

export const updateNotebook = mutation({
  args: {
    id: v.id("tradingJournal"),
    title: nullableStringArg,
    entryReason: nullableStringArg,
    duringTradeNotes: nullableStringArg,
    postTradeReview: nullableStringArg,
    lessonsLearned: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const trade = await ctx.db.get(args.id);
    if (!trade || trade.userId !== userId) {
      throw new Error("Journal entry not found");
    }
    if (trade.deletionRequestedAtMs) {
      throw new Error("Journal entry is being deleted");
    }
    if (!trade.journalId) {
      throw new Error("Trade is not attached to a journal");
    }
    await assertJournalOwned(ctx, userId, trade.journalId);
    await assertEditableJournal(ctx, userId, trade.journalId);

    const existingNotebook = await ctx.db
      .query("tradeNotebooks")
      .withIndex("by_trade", (q) => q.eq("tradeId", args.id))
      .unique();

    if (existingNotebook && existingNotebook.userId !== userId) {
      throw new Error("Notebook ownership mismatch");
    }

    const journalTitle =
      args.title !== undefined
        ? normalizeNotebookTitle(args.title)
        : trade.journalTitle ?? null;

    const entryReason =
      args.entryReason !== undefined
        ? normalizeNotebookText(args.entryReason)
        : existingNotebook?.entryReason ?? null;
    const duringTradeNotes =
      args.duringTradeNotes !== undefined
        ? normalizeNotebookText(args.duringTradeNotes)
        : existingNotebook?.duringTradeNotes ?? null;
    const postTradeReview =
      args.postTradeReview !== undefined
        ? normalizeNotebookText(args.postTradeReview)
        : existingNotebook?.postTradeReview ?? null;
    const lessonsLearned =
      args.lessonsLearned !== undefined
        ? normalizeNotebookText(args.lessonsLearned)
        : existingNotebook?.lessonsLearned ?? null;

    const journalStatus = deriveJournalStatus({
      entryReason,
      duringTradeNotes,
      postTradeReview,
      lessonsLearned,
    });
    const previewSource =
      entryReason
      ?? postTradeReview
      ?? lessonsLearned
      ?? duringTradeNotes
      ?? null;
    const journalPreview = previewSource
      ? previewSource.replace(/\s+/g, " ").trim().slice(0, 220)
      : null;
    const now = Date.now();

    if (existingNotebook) {
      await ctx.db.patch(existingNotebook._id, {
        entryReason,
        duringTradeNotes,
        postTradeReview,
        lessonsLearned,
        updatedAtMs: now,
      });
    } else {
      await ctx.db.insert("tradeNotebooks", {
        userId,
        journalId: trade.journalId,
        tradeId: args.id,
        entryReason,
        duringTradeNotes,
        postTradeReview,
        lessonsLearned,
        createdAtMs: now,
        updatedAtMs: now,
      });
    }

    await ctx.db.patch(args.id, {
      journalTitle,
      journalStatus,
      journalPreview,
      journalUpdatedAtMs: now,
      updatedAtMs: now,
    });

    // Notebook writes never invalidate trade facts or journal analytics.
    const updatedTrade = await ctx.db.get(args.id);
    const updatedNotebook = await ctx.db
      .query("tradeNotebooks")
      .withIndex("by_trade", (q) => q.eq("tradeId", args.id))
      .unique();

    return { trade: updatedTrade, notebook: updatedNotebook };
  },
});

const deleteJournalEntryRows = async (
  ctx: { db: any },
  userId: string,
  id: Id<"tradingJournal">,
  existing: any,
) => {
  const [notebook, attachments, usage] = await Promise.all([
    ctx.db
      .query("tradeNotebooks")
      .withIndex("by_trade", (q: any) => q.eq("tradeId", id))
      .unique(),
    ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_trade_role", (q: any) => q.eq("tradeId", id))
      .collect(),
    ctx.db
      .query("userStorageUsage")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .unique(),
  ]);

  if (notebook && notebook.userId === userId) {
    await ctx.db.delete(notebook._id);
  }

  const ownedAttachments = attachments.filter((row: any) => row.userId === userId);
  const readyRows = ownedAttachments.filter((row: any) => row.status === "ready");
  const pendingRows = ownedAttachments.filter((row: any) => row.status === "pending");

  for (const row of ownedAttachments) {
    await ctx.db.delete(row._id);
  }

  if (usage) {
    await ctx.db.patch(usage._id, {
      usedBytes: Math.max(
        0,
        usage.usedBytes - readyRows.reduce((sum: number, row: any) => sum + row.sizeBytes, 0),
      ),
      attachmentCount: Math.max(0, usage.attachmentCount - readyRows.length),
      reservedBytes: Math.max(
        0,
        (usage.reservedBytes ?? 0)
          - pendingRows.reduce((sum: number, row: any) => sum + row.sizeBytes, 0),
      ),
      reservedCount: Math.max(0, (usage.reservedCount ?? 0) - pendingRows.length),
      updatedAtMs: Date.now(),
    });
  }

  await removeTradeFact(ctx, id);
  await ctx.db.delete(id);

  if (existing.journalType !== "notebook_draft") {
    await bumpJournalStatsVersion(ctx, userId, existing.journalId ?? null);
  }
};

export const beginDeleteEntry = mutation({
  args: { id: v.id("tradingJournal") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Journal entry not found");
    }

    const attachments = await ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_trade_role", (q) => q.eq("tradeId", args.id))
      .collect();

    await ctx.db.patch(args.id, {
      deletionRequestedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    return {
      objectKeys: attachments
        .filter((row) => row.userId === userId)
        .map((row) => row.objectKey)
        .filter((key) => Boolean(key) && key !== "pending"),
    };
  },
});

export const cancelDeleteEntry = mutation({
  args: { id: v.id("tradingJournal") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      return { success: true };
    }

    await ctx.db.patch(args.id, {
      deletionRequestedAtMs: null,
      updatedAtMs: Date.now(),
    });
    return { success: true };
  },
});

export const finalizeDeleteEntry = mutation({
  args: { id: v.id("tradingJournal") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      return { success: true };
    }
    if (!existing.deletionRequestedAtMs) {
      throw new Error("Journal deletion has not been prepared");
    }

    await deleteJournalEntryRows(ctx, userId, args.id, existing);
    return { success: true };
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

    const attachments = await ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_trade_role", (q) => q.eq("tradeId", args.id))
      .collect();
    const hasStoredAssets = attachments.some(
      (row) => row.userId === userId && row.objectKey !== "pending",
    );
    if (hasStoredAssets) {
      throw new Error("Journal has stored images and requires asset-aware deletion");
    }

    await deleteJournalEntryRows(ctx, userId, args.id, existing);
    return { success: true };
  },
});

export const saveMany = mutation({
  args: {
    items: v.array(v.object(tradeCreateFields)),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    if (!(await getProAccess(ctx, userId)).pro) throw new Error("PRO_REQUIRED: CSV import requires Poscal Pro");
    if (args.items.length > 100) {
      throw new Error("Batch too large (max 100 trades)");
    }
    const ids = [];
    const now = Date.now();
    const touchedJournalIds = new Set<Id<"tradingAccounts">>();

    for (const item of args.items) {
      await assertJournalOwned(ctx, userId, item.journalId);
      await assertEditableJournal(ctx, userId, item.journalId);
      assertValidTradeFields(item);

      if (item.externalId) {
        const existing = await ctx.db
          .query("tradingJournal")
          .withIndex("by_user_external", (q) =>
            q.eq("userId", userId).eq("externalId", item.externalId),
          )
          .first();
        if (existing) {
          ids.push(existing._id);
          continue;
        }
      }

      await consumeEntryAllowance(ctx, userId, item.journalId);
      const insertedId = await ctx.db.insert("tradingJournal", {
        ...item,
        userId,
        journalId: item.journalId ?? null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      ids.push(insertedId);
      const insertedTrade = await ctx.db.get(insertedId);
      if (insertedTrade) {
        await syncTradeFact(ctx, insertedTrade);
      }
      if (item.journalId) touchedJournalIds.add(item.journalId);
    }

    for (const journalId of touchedJournalIds) {
      await bumpJournalStatsVersion(ctx, userId, journalId);
    }

    return ids;
  },
});
