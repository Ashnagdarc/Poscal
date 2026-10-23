/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { convexTest } from "convex-test";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const { userId, journalId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "offline@example.test",
      emailVerificationTime: 1,
    });
    const journalId = await ctx.db.insert("tradingAccounts", {
      userId,
      name: "Offline journal",
      currency: "USD",
      balance: 10_000,
      startingBalance: 10_000,
      createdAtMs: 1,
      updatedAtMs: 1,
    });
    return { userId, journalId };
  });
  return {
    t,
    userId,
    journalId,
    user: t.withIdentity({ subject: `${userId}|test` }),
  };
}

const entry = (journalId: Id<"tradingAccounts">) => ({
  journalId,
  pair: "EUR/USD",
  direction: "long" as const,
  status: "open" as const,
});

describe("offline journal replay", () => {
  it("returns the original create result for a duplicate replay", async () => {
    const { t, user, journalId } = await setup();
    const first = await user.mutation(api.tradingJournal.replayCreateEntry, {
      clientOperationId: "device-a:create:1",
      entry: entry(journalId),
    });
    const second = await user.mutation(api.tradingJournal.replayCreateEntry, {
      clientOperationId: "device-a:create:1",
      entry: entry(journalId),
    });

    expect(first).toMatchObject({ status: "applied", revision: 1 });
    expect(second).toEqual({ ...first, status: "replayed" });
    const rows = await t.run((ctx) => ctx.db.query("tradingJournal").take(10));
    expect(rows).toHaveLength(1);
    const buckets = await t.run((ctx) => ctx.db.query("offlineMutationReceipts").take(10));
    expect(buckets).toHaveLength(1);
    expect(buckets[0].receipts).toHaveLength(1);

    await expect(
      user.mutation(api.tradingJournal.replayUpdateEntry, {
        clientOperationId: "device-a:create:1",
        id: first.entityId,
        expectedRevision: 1,
        patch: { pnl: 10 },
      }),
    ).rejects.toThrow("OFFLINE_SYNC_OPERATION_ID_REUSED");
  });

  it("rejects a stale revision without changing the trade", async () => {
    const { t, user, userId, journalId } = await setup();
    const created = await user.mutation(api.tradingJournal.replayCreateEntry, {
      clientOperationId: "device-a:create:2",
      entry: entry(journalId),
    });
    const onlineUpdate = await user.mutation(api.tradingJournal.updateEntry, {
      id: created.entityId,
      notes: "saved online",
    });
    expect(onlineUpdate?.revision).toBe(2);

    await expect(
      user.mutation(api.tradingJournal.replayUpdateEntry, {
        clientOperationId: "device-a:update:stale",
        id: created.entityId,
        expectedRevision: 1,
        patch: { notes: "stale offline edit" },
      }),
    ).rejects.toThrow("OFFLINE_SYNC_CONFLICT");

    expect(
      (await user.query(api.tradingJournal.getById, { id: created.entityId }))?.notes,
    ).toBe("saved online");
    const bucket = await t.run((ctx) =>
      ctx.db
        .query("offlineMutationReceipts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
    );
    expect(
      bucket?.receipts.some((item) => item.clientOperationId === "device-a:update:stale"),
    ).toBe(false);
  });

  it("keeps replay writes authenticated and isolated by owner", async () => {
    const { t, user, journalId } = await setup();
    const created = await user.mutation(api.tradingJournal.replayCreateEntry, {
      clientOperationId: "device-a:create:3",
      entry: entry(journalId),
    });
    const otherUserId = await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "other@example.test",
        emailVerificationTime: 1,
      }),
    );
    const other = t.withIdentity({ subject: `${otherUserId}|test` });

    await expect(
      other.mutation(api.tradingJournal.replayUpdateEntry, {
        clientOperationId: "other:update:1",
        id: created.entityId,
        expectedRevision: 1,
        patch: { notes: "not mine" },
      }),
    ).rejects.toThrow("Journal entry not found");
    await expect(
      t.mutation(api.tradingJournal.replayDeleteEntry, {
        clientOperationId: "anonymous:delete:1",
        id: created.entityId,
        expectedRevision: 1,
      }),
    ).rejects.toThrow("Not authenticated");
  });

  it("replays notebook updates and deletion exactly once", async () => {
    const { t, user, journalId } = await setup();
    const created = await user.mutation(
      api.tradingJournal.replayCreateNotebookDraft,
      {
        clientOperationId: "device-a:notebook:create:1",
        journalId,
      },
    );
    const firstUpdate = await user.mutation(
      api.tradingJournal.replayUpdateNotebook,
      {
        clientOperationId: "device-a:notebook:update:1",
        id: created.entityId,
        expectedRevision: 1,
        patch: { title: "Offline review", entryReason: "Breakout" },
      },
    );
    const replayedUpdate = await user.mutation(
      api.tradingJournal.replayUpdateNotebook,
      {
        clientOperationId: "device-a:notebook:update:1",
        id: created.entityId,
        expectedRevision: 1,
        patch: { title: "Offline review", entryReason: "Breakout" },
      },
    );
    expect(firstUpdate).toMatchObject({ status: "applied", revision: 2 });
    expect(replayedUpdate).toEqual({ ...firstUpdate, status: "replayed" });

    const deleted = await user.mutation(api.tradingJournal.replayDeleteEntry, {
      clientOperationId: "device-a:notebook:delete:1",
      id: created.entityId,
      expectedRevision: 2,
    });
    expect(deleted).toMatchObject({ status: "applied", revision: null });
    expect(
      await user.mutation(api.tradingJournal.replayDeleteEntry, {
        clientOperationId: "device-a:notebook:delete:1",
        id: created.entityId,
        expectedRevision: 2,
      }),
    ).toEqual({ ...deleted, status: "replayed" });
    expect(await t.run((ctx) => ctx.db.get(created.entityId))).toBeNull();
  });

  it("accepts revision zero for legacy rows and caps receipt storage", async () => {
    const { t, user, userId, journalId } = await setup();
    const legacyTradeId = await t.run((ctx) =>
      ctx.db.insert("tradingJournal", {
        ...entry(journalId),
        userId,
        createdAtMs: 1,
        updatedAtMs: 1,
      }),
    );
    await t.run((ctx) =>
      ctx.db.insert("offlineMutationReceipts", {
        userId,
        receipts: Array.from({ length: 256 }, (_, index) => ({
          clientOperationId: `old:${index}`,
          operation: "update_entry" as const,
          entityId: legacyTradeId,
          revision: 0,
          createdAtMs: index,
        })),
        updatedAtMs: 255,
      }),
    );

    const updated = await user.mutation(api.tradingJournal.replayUpdateEntry, {
      clientOperationId: "device-a:legacy:update:1",
      id: legacyTradeId,
      expectedRevision: 0,
      patch: { notes: "legacy edit" },
    });
    expect(updated.revision).toBe(1);

    const bucket = await t.run((ctx) =>
      ctx.db
        .query("offlineMutationReceipts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
    );
    expect(bucket?.receipts).toHaveLength(256);
    expect(bucket?.receipts.some((item) => item.clientOperationId === "old:0")).toBe(false);
    expect(
      bucket?.receipts.some(
        (item) => item.clientOperationId === "device-a:legacy:update:1",
      ),
    ).toBe(true);
  });
});
