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

    await ctx.db.patch(args.id, {
      status: "archived",
      updatedAtMs: Date.now(),
    });

    return await ctx.db.get(args.id);
  },
});

export const remove = mutation({
  args: {
    id: v.id("tradingAccounts"),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Journal not found");
    }

    let trades = 0;
    let history = 0;
    let sessions = 0;

    const tradeRows = await ctx.db
      .query("tradingJournal")
      .withIndex("by_user_journal_created", (q) =>
        q.eq("userId", userId).eq("journalId", args.id),
      )
      .collect();
    for (const row of tradeRows) {
      await ctx.db.delete(row._id);
      trades += 1;
    }

    const historyRows = await ctx.db
      .query("calculatorHistory")
      .withIndex("by_user_journal_created", (q) =>
        q.eq("userId", userId).eq("journalId", args.id),
      )
      .collect();
    for (const row of historyRows) {
      await ctx.db.delete(row._id);
      history += 1;
    }

    const sessionRows = await ctx.db
      .query("progressSessions")
      .withIndex("by_user_journal_date", (q) =>
        q.eq("userId", userId).eq("journalId", args.id),
      )
      .collect();
    for (const row of sessionRows) {
      await ctx.db.delete(row._id);
      sessions += 1;
    }

    await ctx.db.delete(args.id);

    return { success: true, trades, history, sessions };
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
