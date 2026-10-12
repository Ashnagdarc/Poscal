/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { PaginationResult } from "convex/server";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const { userId, journalId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { email: "synthetic@example.test", emailVerificationTime: 1 });
    const journalId = await ctx.db.insert("tradingAccounts", {
      userId, name: "Synthetic", currency: "USD", balance: 10000, startingBalance: 10000,
      createdAtMs: 1, updatedAtMs: 1,
    });
    return { userId, journalId };
  });
  const user = t.withIdentity({ subject: `${userId}|test` });
  const settle = () => t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await user.mutation(api.journalTradeStats.ensureForJournal, { journalId });
  await settle();
  return { t, user, journalId, userId, settle };
}

const entry = (journalId: Id<"tradingAccounts">, pnl = 10) => ({
  journalId, pair: "GBP/USD", direction: "short" as const, status: "closed" as const, pnl,
});

describe("journal writes and paginated reads in an isolated in-memory database", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("updates a ready summary on insert without another history rebuild", async () => {
    const { user, journalId } = await setup();
    await user.mutation(api.tradingJournal.createEntry, entry(journalId));
    const result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stale).toBe(false);
    expect(result?.stats).toMatchObject({ totalTrades: 1, totalPnl: 10, wins: 1, maxConsecutiveWins: 1 });
    expect(await user.mutation(api.journalTradeStats.ensureForJournal, { journalId })).toEqual({ status: "ready" });
  });

  it("applies edits and deletions to additive totals, then reconciles ordered metrics", async () => {
    const { user, journalId, settle } = await setup();
    const trade = await user.mutation(api.tradingJournal.createEntry, entry(journalId));
    await user.mutation(api.tradingJournal.updateEntry, { id: trade!._id, pnl: -5 });
    let result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stats).toMatchObject({ totalTrades: 1, wins: 0, losses: 1, totalPnl: -5, orderedMetricsStale: true });
    await user.mutation(api.journalTradeStats.ensureForJournal, { journalId });
    await settle();
    result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stale).toBe(false);
    expect(result?.stats).toMatchObject({ bestTrade: -5, maxDrawdown: -5 });
    await user.mutation(api.tradingJournal.deleteEntry, { id: trade!._id });
    result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stats).toMatchObject({ totalTrades: 0, closedWithPnl: 0, totalPnl: 0 });
  });

  it("does not count a retried import twice", async () => {
    const { user, journalId } = await setup();
    const items = [0, 1, 2].map(i => ({ ...entry(journalId, i - 1), externalId: `import-${i}` }));
    const ids = await user.mutation(api.tradingJournal.saveMany, { items });
    expect(await user.mutation(api.tradingJournal.saveMany, { items })).toEqual(ids);
    const result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stale).toBe(false);
    expect(result?.stats).toMatchObject({ totalTrades: 3, wins: 1, losses: 1, breakeven: 1, totalPnl: 0 });
  });

  it("handles a break-even trade reopened as an open trade", async () => {
    const { user, journalId } = await setup();
    const trade = await user.mutation(api.tradingJournal.createEntry, entry(journalId, 0));
    await user.mutation(api.tradingJournal.updateEntry, { id: trade!._id, status: "open", pnl: null });
    const result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stats).toMatchObject({ totalTrades: 1, closedWithPnl: 0, openTrades: 1, breakeven: 0 });
  });

  it("keeps all 501 records reachable beyond the old list limit", async () => {
    const { user, journalId } = await setup();
    for (let offset = 0; offset < 501; offset += 100) {
      await user.mutation(api.tradingJournal.saveMany, {
        items: Array.from({ length: Math.min(100, 501 - offset) }, (_, i) => ({
          ...entry(journalId), externalId: `page-${offset + i}`,
        })),
      });
    }
    const ids: string[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: PaginationResult<Doc<"tradingJournal">> = await user.query(api.tradingJournal.listForUserPaginated, {
        journalId, paginationOpts: { numItems: 50, cursor },
      });
      ids.push(...page.page.map(row => row._id));
      if (page.isDone) break;
      cursor = page.continueCursor;
    }
    expect(ids).toHaveLength(501);
    expect(new Set(ids).size).toBe(501);
    const result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stats).toMatchObject({ totalTrades: 501, totalPnl: 5010 });
    expect(result?.stale).toBe(false);
  });

  it("rejects another account reading or editing this journal", async () => {
    const { t, user, journalId } = await setup();
    const trade = await user.mutation(api.tradingJournal.createEntry, entry(journalId));
    const otherId = await t.run(ctx => ctx.db.insert("users", { emailVerificationTime: 1 }));
    const other = t.withIdentity({ subject: `${otherId}|test` });
    await expect(other.query(api.tradingJournal.listForUserPaginated, {
      journalId, paginationOpts: { numItems: 50, cursor: null },
    })).rejects.toThrow("Journal not found");
    await expect(other.mutation(api.tradingJournal.updateEntry, { id: trade!._id, pnl: 99 })).rejects.toThrow("Journal entry not found");
  });

  it("rebuilds 10,000 local trades once and then appends without rebuilding", async () => {
    const { t, user, userId, journalId, settle } = await setup();
    for (let offset = 0; offset < 10000; offset += 500) {
      await t.run(async ctx => {
        for (let i = offset; i < offset + 500; i++) {
          await ctx.db.insert("tradingJournal", {
            ...entry(journalId, i % 2 ? -1 : 2), userId, createdAtMs: i, updatedAtMs: i,
          });
        }
      });
    }
    await t.run(ctx => ctx.db.patch(journalId, { statsVersion: 1 }));
    await user.mutation(api.journalTradeStats.ensureForJournal, { journalId });
    await settle();
    await user.mutation(api.tradingJournal.createEntry, entry(journalId, 3));
    const result = await user.query(api.journalTradeStats.getForJournal, { journalId });
    expect(result?.stale).toBe(false);
    expect(result?.stats).toMatchObject({ totalTrades: 10001, totalPnl: 5003, wins: 5001, losses: 5000 });
  }, 30000);
});
