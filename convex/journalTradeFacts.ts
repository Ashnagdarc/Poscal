import { anyApi } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
import { getVerifiedAuthUserId, requireVerifiedAuthUserId } from "./lib/auth";

const BATCH_SIZE = 200;
const MAX_LOOKBACK_YEARS = 5;
const RANGE_PAD_MS = 2 * 24 * 60 * 60 * 1000;

const dateKeyInTimeZone = (timestampMs: number, timeZone?: string | null) => {
  const date = new Date(timestampMs);
  if (!timeZone) return date.toISOString().slice(0, 10);
  try {
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) return formatted;
  } catch {
    // Fall back to UTC below.
  }
  return date.toISOString().slice(0, 10);
};

const currentYearInTimeZone = (timeZone?: string | null) =>
  Number(dateKeyInTimeZone(Date.now(), timeZone).slice(0, 4));

const assertOwnedJournal = async (
  ctx: { db: any },
  userId: string,
  journalId: Id<"tradingAccounts">,
) => {
  const journal = await ctx.db.get(journalId);
  if (!journal || journal.userId !== userId) throw new Error("Journal not found");
  return journal;
};

const syncFact = async (ctx: { db: any }, trade: Doc<"tradingJournal">) => {
  const existing = await ctx.db
    .query("journalTradeFacts")
    .withIndex("by_trade", (q: any) => q.eq("tradeId", trade._id))
    .unique();

  if (!trade.journalId || trade.status !== "closed") {
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

export const getStatus = query({
  args: { journalId: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return null;
    const journal = await assertOwnedJournal(ctx, userId, args.journalId);
    const currentVersion = journal.statsVersion ?? 0;
    const state = await ctx.db
      .query("journalTradeFactsBackfills")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", userId).eq("journalId", args.journalId),
      )
      .unique();

    return {
      ready: Boolean(state && state.status === "complete" && state.sourceVersion === currentVersion),
      currentVersion,
      sourceVersion: state?.sourceVersion ?? null,
      status: state?.status ?? null,
    };
  },
});

export const ensureForJournal = mutation({
  args: { journalId: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const journal = await assertOwnedJournal(ctx, userId, args.journalId);
    const sourceVersion = journal.statsVersion ?? 0;
    const existing = await ctx.db
      .query("journalTradeFactsBackfills")
      .withIndex("by_user_journal", (q) =>
        q.eq("userId", userId).eq("journalId", args.journalId),
      )
      .unique();

    if (existing?.status === "complete" && existing.sourceVersion === sourceVersion) {
      return { status: "ready" as const };
    }

    const now = Date.now();
    let backfillId: Id<"journalTradeFactsBackfills">;
    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceVersion,
        status: "running",
        cursor: null,
        processedTrades: 0,
        startedAtMs: now,
        updatedAtMs: now,
      });
      backfillId = existing._id;
    } else {
      backfillId = await ctx.db.insert("journalTradeFactsBackfills", {
        userId,
        journalId: args.journalId,
        sourceVersion,
        status: "running",
        cursor: null,
        processedTrades: 0,
        startedAtMs: now,
        updatedAtMs: now,
      });
    }

    await ctx.scheduler.runAfter(0, anyApi.journalTradeFacts.processBackfill, {
      backfillId,
    });
    return { status: "started" as const };
  },
});

export const processBackfill = internalMutation({
  args: { backfillId: v.id("journalTradeFactsBackfills") },
  handler: async (ctx, args) => {
    const state = await ctx.db.get(args.backfillId);
    if (!state || state.status !== "running") return;

    const journal = await ctx.db.get(state.journalId);
    if (!journal || journal.userId !== state.userId) {
      await ctx.db.patch(state._id, { status: "failed", updatedAtMs: Date.now() });
      return;
    }

    const currentVersion = journal.statsVersion ?? 0;
    if (currentVersion !== state.sourceVersion) {
      await ctx.db.patch(state._id, {
        sourceVersion: currentVersion,
        cursor: null,
        processedTrades: 0,
        startedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      await ctx.scheduler.runAfter(0, anyApi.journalTradeFacts.processBackfill, {
        backfillId: state._id,
      });
      return;
    }

    const page = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_journal_created", (q) =>
        q.eq("userId", state.userId).eq("journalId", state.journalId),
      )
      .order("asc")
      .paginate({
        numItems: BATCH_SIZE,
        cursor: state.cursor ?? null,
      });

    for (const trade of page.page) {
      await syncFact(ctx, trade);
    }

    if (!page.isDone) {
      await ctx.db.patch(state._id, {
        cursor: page.continueCursor,
        processedTrades: state.processedTrades + page.page.length,
        updatedAtMs: Date.now(),
      });
      await ctx.scheduler.runAfter(0, anyApi.journalTradeFacts.processBackfill, {
        backfillId: state._id,
      });
      return;
    }

    const finalJournal = await ctx.db.get(state.journalId);
    const finalVersion = finalJournal?.statsVersion ?? 0;
    if (!finalJournal || finalJournal.userId !== state.userId) {
      await ctx.db.patch(state._id, { status: "failed", updatedAtMs: Date.now() });
      return;
    }

    if (finalVersion !== state.sourceVersion) {
      await ctx.db.patch(state._id, {
        sourceVersion: finalVersion,
        cursor: null,
        processedTrades: 0,
        startedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
      await ctx.scheduler.runAfter(0, anyApi.journalTradeFacts.processBackfill, {
        backfillId: state._id,
      });
      return;
    }

    await ctx.db.patch(state._id, {
      cursor: page.continueCursor,
      processedTrades: state.processedTrades + page.page.length,
      status: "complete",
      updatedAtMs: Date.now(),
    });
  },
});

const requireReady = async (
  ctx: { db: any },
  userId: string,
  journalId: Id<"tradingAccounts">,
) => {
  const journal = await assertOwnedJournal(ctx, userId, journalId);
  const state = await ctx.db
    .query("journalTradeFactsBackfills")
    .withIndex("by_user_journal", (q: any) =>
      q.eq("userId", userId).eq("journalId", journalId),
    )
    .unique();
  return Boolean(
    state
    && state.status === "complete"
    && state.sourceVersion === (journal.statsVersion ?? 0)
  );
};

export const getMonthSummary = query({
  args: {
    journalId: v.id("tradingAccounts"),
    year: v.number(),
    month: v.number(),
    timeZone: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return { ready: false, days: [] };
    if (!(await requireReady(ctx, userId, args.journalId))) {
      return { ready: false, days: [] };
    }

    const monthIndex = Math.min(Math.max(Math.trunc(args.month) - 1, 0), 11);
    const roughStart = Date.UTC(args.year, monthIndex, 1) - RANGE_PAD_MS;
    const roughEnd = Date.UTC(args.year, monthIndex + 1, 1) + RANGE_PAD_MS;
    const prefix = `${args.year}-${String(monthIndex + 1).padStart(2, "0")}`;

    const facts = await ctx.db
      .query("journalTradeFacts")
      .withIndex("by_user_journal_date", (q) =>
        q
          .eq("userId", userId)
          .eq("journalId", args.journalId)
          .gte("analyticsAtMs", roughStart)
          .lt("analyticsAtMs", roughEnd),
      )
      .collect();

    const buckets = new Map<string, {
      dateKey: string;
      tradeCount: number;
      pnl: number;
      wins: number;
      losses: number;
      breakeven: number;
    }>();

    for (const fact of facts) {
      const dateKey = dateKeyInTimeZone(fact.analyticsAtMs, args.timeZone);
      if (!dateKey.startsWith(prefix)) continue;
      const row = buckets.get(dateKey) ?? {
        dateKey,
        tradeCount: 0,
        pnl: 0,
        wins: 0,
        losses: 0,
        breakeven: 0,
      };
      row.tradeCount += 1;
      row.pnl += fact.pnl;
      if (fact.pnl > 0) row.wins += 1;
      else if (fact.pnl < 0) row.losses += 1;
      else row.breakeven += 1;
      buckets.set(dateKey, row);
    }

    return {
      ready: true,
      days: Array.from(buckets.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
    };
  },
});

export const getMonthlyReturns = query({
  args: {
    journalId: v.id("tradingAccounts"),
    timeZone: v.optional(v.union(v.string(), v.null())),
    lookbackYears: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return { ready: false, years: [], returns: [] };
    const journal = await assertOwnedJournal(ctx, userId, args.journalId);
    if (!(await requireReady(ctx, userId, args.journalId))) {
      return { ready: false, years: [], returns: [] };
    }

    const lookbackYears = Math.min(Math.max(Math.trunc(args.lookbackYears ?? 5), 1), MAX_LOOKBACK_YEARS);
    const currentYear = currentYearInTimeZone(args.timeZone);
    const firstYear = currentYear - lookbackYears + 1;
    const roughStart = Date.UTC(firstYear, 0, 1) - RANGE_PAD_MS;
    const roughEnd = Date.UTC(currentYear + 1, 0, 1) + RANGE_PAD_MS;

    const facts = await ctx.db
      .query("journalTradeFacts")
      .withIndex("by_user_journal_date", (q) =>
        q
          .eq("userId", userId)
          .eq("journalId", args.journalId)
          .gte("analyticsAtMs", roughStart)
          .lt("analyticsAtMs", roughEnd),
      )
      .collect();

    const monthlyPnl = new Map<string, number>();
    for (const fact of facts) {
      const dateKey = dateKeyInTimeZone(fact.analyticsAtMs, args.timeZone);
      const year = Number(dateKey.slice(0, 4));
      if (year < firstYear || year > currentYear) continue;
      const month = Number(dateKey.slice(5, 7)) - 1;
      const key = `${year}-${month}`;
      monthlyPnl.set(key, (monthlyPnl.get(key) ?? 0) + fact.pnl);
    }

    const years = Array.from({ length: lookbackYears }, (_, index) => firstYear + index);
    const baseCapital = journal.startingBalance && journal.startingBalance > 0
      ? journal.startingBalance
      : 10000;

    return {
      ready: true,
      years,
      returns: years.map((year) =>
        Array.from({ length: 12 }, (_, month) => {
          const pnl = monthlyPnl.get(`${year}-${month}`) ?? 0;
          return Math.round((pnl / baseCapital) * 1000) / 10;
        }),
      ),
    };
  },
});

export const listForSelection = query({
  args: {
    journalId: v.id("tradingAccounts"),
    dateKey: v.optional(v.union(v.string(), v.null())),
    monthKey: v.optional(v.union(v.string(), v.null())),
    timeZone: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return [];
    if (!(await requireReady(ctx, userId, args.journalId))) return [];

    const target = args.dateKey ?? args.monthKey;
    if (!target) return [];

    const [yearText, monthText, dayText] = target.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = dayText ? Number(dayText) : null;
    if (!Number.isFinite(year) || !Number.isFinite(month)) return [];

    const roughStart = Date.UTC(year, month - 1, day ?? 1) - RANGE_PAD_MS;
    const roughEnd = day
      ? Date.UTC(year, month - 1, day + 1) + RANGE_PAD_MS
      : Date.UTC(year, month, 1) + RANGE_PAD_MS;

    const facts = await ctx.db
      .query("journalTradeFacts")
      .withIndex("by_user_journal_date", (q) =>
        q
          .eq("userId", userId)
          .eq("journalId", args.journalId)
          .gte("analyticsAtMs", roughStart)
          .lt("analyticsAtMs", roughEnd),
      )
      .collect();

    const matching = facts.filter((fact) => {
      const key = dateKeyInTimeZone(fact.analyticsAtMs, args.timeZone);
      return args.dateKey ? key === args.dateKey : key.startsWith(args.monthKey ?? "");
    });

    const rows = await Promise.all(matching.slice(0, 1000).map((fact) => ctx.db.get(fact.tradeId)));
    return rows.filter((row): row is NonNullable<typeof row> => Boolean(row));
  },
});
