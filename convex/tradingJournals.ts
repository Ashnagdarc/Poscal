import { getProAccess, assertEditableJournal, getActiveJournals } from "./lib/proAccess";
import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getVerifiedAuthUserId, requireVerifiedAuthUserId } from "./lib/auth";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));

type UserId = Id<"users">;
const isActiveJournal = (status?: string | null) => status !== "archived";

export const listForUser = query({
  args: {
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const rows = args.includeArchived ? await ctx.db
      .query("tradingAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100) : await getActiveJournals(ctx, userId);

    const access = await getProAccess(ctx, userId);
    const filtered = args.includeArchived
      ? rows
      : rows.filter((row) => isActiveJournal(row.status));

    return filtered.sort((a, b) => b.createdAtMs - a.createdAtMs).map(row => ({ ...row, isReadOnly: row.status === "archived" || access.lockedJournalIds.includes(row._id) }));
  },
});

// Soft status whitelist (AP-013 / MC-033).
const ALLOWED_JOURNAL_STATUS = new Set(["active", "archived", "funded", "demo", "live", "eval"]);

export const create = mutation({
  args: {
    name: v.string(),
    currency: v.string(),
    startingBalance: v.number(),
    fullName: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Journal name is required");
    }
    if (!Number.isFinite(args.startingBalance) || args.startingBalance <= 0 || args.startingBalance > 1e9) {
      throw new Error("Account size must be greater than zero and under 1,000,000,000");
    }
    const currency = args.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Currency must be a 3-letter code (e.g. USD)");
    }

    const access = await getProAccess(ctx, userId);
    if (access.usage.journals >= access.limits.journals) {
      throw new Error(`PRO_REQUIRED: Journal limit reached (${access.limits.journals}). Your existing journals are safe.`);
    }

    const now = Date.now();
    const insertedId = await ctx.db.insert("tradingAccounts", {
      userId,
      externalId: null,
      name: trimmedName,
      broker: null,
      currency,
      balance: args.startingBalance,
      startingBalance: args.startingBalance,
      status: "active",
      createdAtMs: now,
      updatedAtMs: now,
    });

    if (args.fullName?.trim()) {
      const fullName = args.fullName.trim();
      const userDoc = await ctx.db.get(userId as UserId);
      if (userDoc) {
        await ctx.db.patch(userDoc._id, {
          fullName,
          name: fullName,
        });
      }

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
        .first();

      if (profile) {
        await ctx.db.patch(profile._id, {
          fullName,
          journalOnboardedAtMs: now,
          updatedAtMs: now,
        });
      } else if (userDoc?.email) {
        await ctx.db.insert("profiles", {
          externalUserId: userId,
          email: userDoc.email,
          fullName,
          avatarUrl: userDoc.avatarUrl ?? userDoc.image ?? null,
          role: userDoc.role,

          journalOnboardedAtMs: now,
          createdAtMs: now,
          updatedAtMs: now,
        });
      }
    } else {
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
        .first();
      if (profile && !profile.journalOnboardedAtMs) {
        await ctx.db.patch(profile._id, {
          journalOnboardedAtMs: now,
          updatedAtMs: now,
        });
      }
    }

    return await ctx.db.get(insertedId);
  },
});

export const update = mutation({
  args: {
    id: v.id("tradingAccounts"),
    name: nullableStringArg,
    currency: nullableStringArg,
    startingBalance: nullableNumberArg,
    balance: nullableNumberArg,
    status: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Journal not found");
    }

    await assertEditableJournal(ctx, userId, args.id);
    const patch: Record<string, unknown> = {
      updatedAtMs: Date.now(),
    };

    if (args.name !== undefined && args.name !== null) {
      const trimmed = args.name.trim();
      if (!trimmed) throw new Error("Journal name is required");
      patch.name = trimmed;
    }
    if (args.currency !== undefined && args.currency !== null) {
      const nextCurrency = args.currency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(nextCurrency)) {
        throw new Error("Currency must be a 3-letter code (e.g. USD)");
      }
      patch.currency = nextCurrency;
    }
    if (args.startingBalance !== undefined && args.startingBalance !== null) {
      if (!Number.isFinite(args.startingBalance) || args.startingBalance <= 0 || args.startingBalance > 1e9) {
        throw new Error("Account size must be greater than zero");
      }
      patch.startingBalance = args.startingBalance;
    }
    if (args.balance !== undefined && args.balance !== null) {
      if (!Number.isFinite(args.balance) || args.balance < -1e9 || args.balance > 1e9) {
        throw new Error("Balance out of range");
      }
      patch.balance = args.balance;
    }
    if (args.status !== undefined && args.status !== null) {
      const status = args.status.trim().toLowerCase();
      if (!ALLOWED_JOURNAL_STATUS.has(status)) {
        throw new Error("Invalid journal status");
      }
      patch.status = status;
    }

    await ctx.db.patch(args.id, patch);
    return await ctx.db.get(args.id);
  },
});

export const archive = mutation({
  args: {
    id: v.id("tradingAccounts"),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Journal not found");
    }

    const access = await getProAccess(ctx, userId);
    if (!access.pro && access.freeJournalId === args.id) {
      throw new Error(
        access.canChooseFreeJournal
          ? "Choose your one Free journal before archiving the current Free journal."
          : "PRO_REQUIRED: Your selected Free journal cannot be archived while you are on Free.",
      );
    }

    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAtMs: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

export const beginRemove = mutation({
  args: { id: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Journal not found");
    }

    const access = await getProAccess(ctx, userId);
    if (!access.pro && access.freeJournalId === args.id) {
      throw new Error(
        access.canChooseFreeJournal
          ? "Choose your one Free journal before deleting the current Free journal."
          : "PRO_REQUIRED: Your selected Free journal cannot be deleted while you are on Free.",
      );
    }

    if (!existing.deletionRequestedAtMs) {
      await ctx.db.patch(args.id, {
        status: "archived",
        deletionRequestedAtMs: Date.now(),
        updatedAtMs: Date.now(),
      });
    }

    return { success: true };
  },
});

export const removeBatch = query({
  args: { id: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const journal = await ctx.db.get(args.id);
    if (!journal || journal.userId !== userId) throw new Error("Journal not found");
    if (!journal.deletionRequestedAtMs)
      throw new Error("Journal deletion has not been prepared");

    const rows = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_journal_created", (q) =>
        q.eq("userId", userId).eq("journalId", args.id),
      )
      .take(10);
    return { tradeIds: rows.map((row) => row._id) };
  },
});

export const cleanupRemoveBatch = mutation({
  args: { id: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const journal = await ctx.db.get(args.id);
    if (!journal || journal.userId !== userId) return { done: true };
    if (!journal.deletionRequestedAtMs)
      throw new Error("Journal deletion has not been prepared");

    const remainingTrade = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_journal_created", (q) =>
        q.eq("userId", userId).eq("journalId", args.id),
      )
      .first();
    if (remainingTrade) return { done: false };

    // Entry deletion is responsible for R2 and notebook cleanup. Refuse to
    // remove the parent if any child escaped that path.
    const [attachment, notebook, fact] = await Promise.all([
      ctx.db
        .query("tradeJournalAttachments")
        .withIndex("by_journal", (q) => q.eq("journalId", args.id))
        .first(),
      ctx.db
        .query("tradeNotebooks")
        .withIndex("by_journal", (q) => q.eq("journalId", args.id))
        .first(),
      ctx.db
        .query("journalTradeFacts")
        .withIndex("by_user_journal_date", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .first(),
    ]);
    if (attachment || notebook || fact) {
      throw new Error(
        "Journal child cleanup is incomplete. Retry deletion before removing the journal.",
      );
    }

    const [historyRows, sessionRows] = await Promise.all([
      ctx.db
        .query("calculatorHistory")
        .withIndex("by_user_journal_created", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .take(50),
      ctx.db
        .query("progressSessions")
        .withIndex("by_user_journal_date", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .take(50),
    ]);
    for (const row of historyRows) await ctx.db.delete(row._id);
    for (const row of sessionRows) await ctx.db.delete(row._id);

    const [historyLeft, sessionsLeft] = await Promise.all([
      ctx.db
        .query("calculatorHistory")
        .withIndex("by_user_journal_created", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .first(),
      ctx.db
        .query("progressSessions")
        .withIndex("by_user_journal_date", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .first(),
    ]);
    if (historyLeft || sessionsLeft) return { done: false };

    const [factsBackfill, stats, statsBackfill] = await Promise.all([
      ctx.db
        .query("journalTradeFactsBackfills")
        .withIndex("by_user_journal", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .unique(),
      ctx.db
        .query("journalTradeStats")
        .withIndex("by_user_journal", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .unique(),
      ctx.db
        .query("journalTradeStatsBackfills")
        .withIndex("by_user_journal", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .unique(),
    ]);
    if (factsBackfill) await ctx.db.delete(factsBackfill._id);
    if (stats) await ctx.db.delete(stats._id);
    if (statsBackfill) await ctx.db.delete(statsBackfill._id);

    const account = await ctx.db
      .query("proAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (account?.freeJournalId === args.id) {
      await ctx.db.patch(account._id, {
        freeJournalId: undefined,
        freeJournalChosen: false,
        updatedAtMs: Date.now(),
      });
    }

    await ctx.db.delete(args.id);
    return { done: true };
  },
});

/**
 * Backward-compatible mutation for cached clients. It only deletes a truly
 * empty journal. Non-empty journals must use the asset-aware resumable route.
 */
export const remove = mutation({
  args: { id: v.id("tradingAccounts") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Journal not found");

    const access = await getProAccess(ctx, userId);
    if (!access.pro && access.freeJournalId === args.id) {
      throw new Error(
        access.canChooseFreeJournal
          ? "Choose your one Free journal before deleting the current Free journal."
          : "PRO_REQUIRED: Your selected Free journal cannot be deleted while you are on Free.",
      );
    }

    const [trade, attachment, notebook, fact] = await Promise.all([
      ctx.db
        .query("tradingJournal")
        .withIndex("by_user_journal_created", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .first(),
      ctx.db
        .query("tradeJournalAttachments")
        .withIndex("by_journal", (q) => q.eq("journalId", args.id))
        .first(),
      ctx.db
        .query("tradeNotebooks")
        .withIndex("by_journal", (q) => q.eq("journalId", args.id))
        .first(),
      ctx.db
        .query("journalTradeFacts")
        .withIndex("by_user_journal_date", (q) =>
          q.eq("userId", userId).eq("journalId", args.id),
        )
        .first(),
    ]);
    if (trade || attachment || notebook || fact) {
      throw new Error(
        "This journal contains entries and requires the asset-aware deletion flow. Refresh Poscal and try again.",
      );
    }

    await ctx.db.patch(args.id, {
      status: "archived",
      deletionRequestedAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    // Small empty journals can finish in one call. If non-trade child rows
    // exceed the bounded batch, the refreshed client will resume safely.
    const historyRows = await ctx.db
      .query("calculatorHistory")
      .withIndex("by_user_journal_created", (q) =>
        q.eq("userId", userId).eq("journalId", args.id),
      )
      .take(51);
    const sessionRows = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_journal_date", (q) =>
        q.eq("userId", userId).eq("journalId", args.id),
      )
      .take(51);
    if (historyRows.length > 50 || sessionRows.length > 50) {
      throw new Error(
        "This journal requires the resumable deletion flow. Refresh Poscal and try again.",
      );
    }
    for (const row of historyRows) await ctx.db.delete(row._id);
    for (const row of sessionRows) await ctx.db.delete(row._id);

    await ctx.db.delete(args.id);
    return {
      success: true,
      trades: 0,
      history: historyRows.length,
      sessions: sessionRows.length,
    };
  },
});

export const attachOrphanData = mutation({
  args: {
    journalId: v.id("tradingAccounts"),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const journal = await ctx.db.get(args.journalId);
    if (!journal || journal.userId !== userId) {
      throw new Error("Journal not found");
    }

    let trades = 0;
    let history = 0;
    let sessions = 0;

    const tradeRows = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();

    for (const row of tradeRows) {
      if (row.journalId) continue;
      await ctx.db.patch(row._id, { journalId: args.journalId, updatedAtMs: Date.now() });
      trades += 1;
    }

    const historyRows = await ctx.db
      .query("calculatorHistory")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();

    for (const row of historyRows) {
      if (row.journalId) continue;
      await ctx.db.patch(row._id, {
        journalId: args.journalId,
        updatedAtMs: Date.now(),
      });
      history += 1;
    }

    const sessionRows = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    for (const row of sessionRows) {
      if (row.journalId) continue;
      await ctx.db.patch(row._id, {
        journalId: args.journalId,
        updatedAtMs: Date.now(),
      });
      sessions += 1;
    }

    return { trades, history, sessions };
  },
});

export const getLimits = query({
  args: {},
  handler: async ctx => {
    const userId = await getVerifiedAuthUserId(ctx);
    if (!userId) return { tier: "free" as const, limit: 1, activeCount: 0, canCreate: false };
    const access = await getProAccess(ctx, userId);
    return { tier: access.pro ? "pro" as const : "free" as const, limit: access.limits.journals, activeCount: access.usage.journals, canCreate: access.usage.journals < access.limits.journals };
  },
});
