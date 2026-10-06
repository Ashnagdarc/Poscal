import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { getVerifiedAuthUserId } from "./lib/auth";

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

const assertOwnedJournal = async (
  ctx: { db: any },
  userId: string,
  journalId: Id<"tradingAccounts">,
) => {
  const journal = await ctx.db.get(journalId);
  if (!journal || journal.userId !== userId) {
    throw new Error("Journal not found");
  }
  return journal;
};

type Bucket = {
  dateKey: string;
  journaled: boolean;
  tradeCount: number;
  closedTradeCount: number;
  openTradeCount: number;
  cancelledCount: number;
  pnl: number;
  wins: number;
  losses: number;
  breakeven: number;
};

const emptyBucket = (dateKey: string): Bucket => ({
  dateKey,
  journaled: false,
  tradeCount: 0,
  closedTradeCount: 0,
  openTradeCount: 0,
  cancelledCount: 0,
  pnl: 0,
  wins: 0,
  losses: 0,
  breakeven: 0,
});

/**
 * Calendar data is intentionally read from the actual journal records instead
 * of the closed-trade analytics projection. The calendar is navigation and
 * activity history, so open trades, notebook-only days, older trades, and
 * no-trade day journals must all remain visible.
 */
export const getMonth = query({
  args: {
    journalId: v.id("tradingAccounts"),
    year: v.number(),
    month: v.number(),
    timeZone: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return { days: [] };

    await assertOwnedJournal(ctx, userId, args.journalId);

    const monthIndex = Math.min(Math.max(Math.trunc(args.month) - 1, 0), 11);
    const roughStart = Date.UTC(args.year, monthIndex, 1) - RANGE_PAD_MS;
    const roughEnd = Date.UTC(args.year, monthIndex + 1, 1) + RANGE_PAD_MS;
    const prefix = `${args.year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const monthStartKey = `${prefix}-01`;
    const nextMonth = new Date(Date.UTC(args.year, monthIndex + 1, 1));
    const nextMonthKey = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, "0")}-01`;

    const [datedTrades, createdFallback, sessions] = await Promise.all([
      ctx.db
        .query("tradingJournal")
        .withIndex("by_user_journal_entry_date", (q) =>
          q
            .eq("userId", userId)
            .eq("journalId", args.journalId)
            .gte("entryDateMs", roughStart)
            .lt("entryDateMs", roughEnd),
        )
        .collect(),
      ctx.db
        .query("tradingJournal")
        .withIndex("by_user_journal_created", (q) =>
          q
            .eq("userId", userId)
            .eq("journalId", args.journalId)
            .gte("createdAtMs", roughStart)
            .lt("createdAtMs", roughEnd),
        )
        .collect(),
      ctx.db
        .query("progressSessions")
        .withIndex("by_user_journal_date", (q) =>
          q
            .eq("userId", userId)
            .eq("journalId", args.journalId)
            .gte("dateKey", monthStartKey)
            .lt("dateKey", nextMonthKey),
        )
        .collect(),
    ]);

    const uniqueTrades = new Map<string, (typeof datedTrades)[number]>();
    for (const trade of datedTrades) uniqueTrades.set(String(trade._id), trade);
    for (const trade of createdFallback) {
      if (trade.entryDateMs == null) uniqueTrades.set(String(trade._id), trade);
    }

    const buckets = new Map<string, Bucket>();

    for (const trade of uniqueTrades.values()) {
      if (trade.deletionRequestedAtMs) continue;

      const timestamp = trade.entryDateMs ?? trade.createdAtMs;
      const dateKey = dateKeyInTimeZone(timestamp, args.timeZone);
      if (!dateKey.startsWith(prefix)) continue;

      const bucket = buckets.get(dateKey) ?? emptyBucket(dateKey);
      bucket.journaled = true;

      if (trade.journalType === "notebook_draft") {
        buckets.set(dateKey, bucket);
        continue;
      }

      if (trade.status === "cancelled") {
        bucket.cancelledCount += 1;
        buckets.set(dateKey, bucket);
        continue;
      }

      bucket.tradeCount += 1;

      if (trade.status === "open") {
        bucket.openTradeCount += 1;
      } else if (trade.status === "closed") {
        const pnl = Number.isFinite(trade.pnl) ? (trade.pnl as number) : 0;
        bucket.closedTradeCount += 1;
        bucket.pnl += pnl;
        if (pnl > 0) bucket.wins += 1;
        else if (pnl < 0) bucket.losses += 1;
        else bucket.breakeven += 1;
      }

      buckets.set(dateKey, bucket);
    }

    for (const session of sessions) {
      if (!session.dateKey.startsWith(prefix)) continue;
      const bucket = buckets.get(session.dateKey) ?? emptyBucket(session.dateKey);
      bucket.journaled = true;
      buckets.set(session.dateKey, bucket);
    }

    const days = Array.from(buckets.values())
      .map((bucket) => {
        const tone =
          bucket.closedTradeCount > 0
            ? bucket.pnl > 0
              ? "win"
              : bucket.pnl < 0
                ? "loss"
                : "breakeven"
            : bucket.openTradeCount > 0
              ? "open"
              : "no_trade";

        return {
          ...bucket,
          tone,
        };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return { days };
  },
});
