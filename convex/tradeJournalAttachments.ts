import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireVerifiedAuthUserId } from "./lib/auth";

const FREE_STORAGE_BYTES = 50 * 1024 * 1024;
const FREE_ATTACHMENT_COUNT = 50;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/webp", "image/jpeg", "image/png"]);

const getUsage = async (ctx: any, userId: string) =>
  await ctx.db
    .query("userStorageUsage")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();

const assertOwnedTrade = async (ctx: any, userId: string, tradeId: any) => {
  const trade = await ctx.db.get(tradeId);
  if (!trade || trade.userId !== userId) throw new Error("Journal entry not found");
  if (!trade.journalId) throw new Error("Trade is not attached to a journal");
  if (trade.deletionRequestedAtMs) throw new Error("Journal entry is being deleted");
  return trade;
};

export const listForTrade = query({
  args: { tradeId: v.id("tradingJournal") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    await assertOwnedTrade(ctx, userId, args.tradeId);
    const rows = await ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_trade_role", (q) => q.eq("tradeId", args.tradeId))
      .collect();
    return rows.filter((row) => row.userId === userId && row.status === "ready");
  },
});

export const listPendingForTrade = query({
  args: { tradeId: v.id("tradingJournal") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    await assertOwnedTrade(ctx, userId, args.tradeId);
    const rows = await ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_trade_role", (q) => q.eq("tradeId", args.tradeId))
      .collect();
    return rows.filter((row) => row.userId === userId && row.status === "pending");
  },
});

export const reserveUpload = mutation({
  args: {
    tradeId: v.id("tradingJournal"),
    role: v.union(v.literal("before"), v.literal("after")),
    mimeType: v.string(),
    sizeBytes: v.number(),
    width: v.optional(v.union(v.number(), v.null())),
    height: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const trade = await assertOwnedTrade(ctx, userId, args.tradeId);

    if (!ALLOWED_MIME.has(args.mimeType)) throw new Error("Unsupported image type");
    if (!Number.isFinite(args.sizeBytes) || args.sizeBytes <= 0 || args.sizeBytes > MAX_IMAGE_BYTES) {
      throw new Error("Image must be 2 MB or smaller after compression");
    }

    const existingUsage = await getUsage(ctx, userId);

    // Reclaim abandoned reservations older than 30 minutes so a crashed
    // browser cannot permanently consume a user's free quota.
    const staleCutoff = Date.now() - 30 * 60 * 1000;
    const stalePending = await ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_user_status_created", (q) =>
        q.eq("userId", userId).eq("status", "pending").lt("createdAtMs", staleCutoff),
      )
      .take(20);

    const staleReservedBytes = stalePending.reduce((sum, row) => sum + row.sizeBytes, 0);
    for (const row of stalePending) {
      await ctx.db.patch(row._id, { status: "deleted", updatedAtMs: Date.now() });
    }

    const usedBytes = existingUsage?.usedBytes ?? 0;
    const attachmentCount = existingUsage?.attachmentCount ?? 0;
    const reservedBytes = Math.max(0, (existingUsage?.reservedBytes ?? 0) - staleReservedBytes);
    const reservedCount = Math.max(0, (existingUsage?.reservedCount ?? 0) - stalePending.length);

    if (existingUsage && stalePending.length > 0) {
      await ctx.db.patch(existingUsage._id, {
        reservedBytes,
        reservedCount,
        updatedAtMs: Date.now(),
      });
    }

    const readyForRole = await ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_trade_role", (q) => q.eq("tradeId", args.tradeId).eq("role", args.role))
      .collect();
    const currentReady = readyForRole.find(
      (row) => row.userId === userId && row.status === "ready",
    ) ?? null;

    const projectedBytes =
      usedBytes
      - (currentReady?.sizeBytes ?? 0)
      + reservedBytes
      + args.sizeBytes;
    const projectedCount =
      attachmentCount
      - (currentReady ? 1 : 0)
      + reservedCount
      + 1;

    if (projectedBytes > FREE_STORAGE_BYTES) {
      throw new Error("Free journal image storage limit reached");
    }
    if (projectedCount > FREE_ATTACHMENT_COUNT) {
      throw new Error("Free journal image limit reached");
    }

    const now = Date.now();
    const id = await ctx.db.insert("tradeJournalAttachments", {
      userId,
      journalId: trade.journalId,
      tradeId: args.tradeId,
      role: args.role,
      storageProvider: "r2",
      objectKey: "pending",
      mimeType: args.mimeType,
      sizeBytes: args.sizeBytes,
      width: args.width ?? null,
      height: args.height ?? null,
      sortOrder: 0,
      status: "pending",
      createdAtMs: now,
      updatedAtMs: now,
    });

    const ext = args.mimeType === "image/png" ? "png" : args.mimeType === "image/jpeg" ? "jpg" : "webp";
    const objectKey = `journal/${userId}/${args.tradeId}/${args.role}/${id}.${ext}`;
    await ctx.db.patch(id, { objectKey });

    if (existingUsage) {
      await ctx.db.patch(existingUsage._id, {
        reservedBytes: reservedBytes + args.sizeBytes,
        reservedCount: reservedCount + 1,
        updatedAtMs: now,
      });
    } else {
      await ctx.db.insert("userStorageUsage", {
        userId,
        usedBytes: 0,
        attachmentCount: 0,
        reservedBytes: args.sizeBytes,
        reservedCount: 1,
        updatedAtMs: now,
      });
    }

    return {
      attachmentId: id,
      objectKey,
      maxBytes: MAX_IMAGE_BYTES,
      quota: {
        usedBytes,
        reservedBytes: reservedBytes + args.sizeBytes,
        limitBytes: FREE_STORAGE_BYTES,
        attachmentCount,
        reservedCount: reservedCount + 1,
        limitCount: FREE_ATTACHMENT_COUNT,
      },
      staleObjectKeys: stalePending
        .map((row) => row.objectKey)
        .filter((key) => key && key !== "pending"),
    };
  },
});

export const completeUpload = mutation({
  args: {
    attachmentId: v.id("tradeJournalAttachments"),
    actualSizeBytes: v.number(),
    actualMimeType: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const row = await ctx.db.get(args.attachmentId);
    if (!row || row.userId !== userId || row.status !== "pending") {
      throw new Error("Pending attachment not found");
    }
    await assertOwnedTrade(ctx, userId, row.tradeId);

    if (!ALLOWED_MIME.has(args.actualMimeType)) throw new Error("Uploaded object has an invalid image type");
    if (args.actualSizeBytes <= 0 || args.actualSizeBytes > row.sizeBytes || args.actualSizeBytes > MAX_IMAGE_BYTES) {
      throw new Error("Uploaded object size is invalid");
    }

    const usage = await getUsage(ctx, userId);
    if (!usage) throw new Error("Storage usage record missing");

    const oldReady = await ctx.db
      .query("tradeJournalAttachments")
      .withIndex("by_trade_role", (q) => q.eq("tradeId", row.tradeId).eq("role", row.role))
      .collect();
    const replaced = oldReady.filter((item) => item._id !== row._id && item.status === "ready" && item.userId === userId);

    const replacedBytes = replaced.reduce((sum, item) => sum + item.sizeBytes, 0);
    for (const item of replaced) {
      await ctx.db.patch(item._id, { status: "deleted", updatedAtMs: Date.now() });
    }

    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "ready",
      sizeBytes: args.actualSizeBytes,
      mimeType: args.actualMimeType,
      updatedAtMs: now,
    });

    await ctx.db.patch(usage._id, {
      usedBytes: Math.max(0, usage.usedBytes - replacedBytes + args.actualSizeBytes),
      attachmentCount: Math.max(0, usage.attachmentCount - replaced.length + 1),
      reservedBytes: Math.max(0, (usage.reservedBytes ?? 0) - row.sizeBytes),
      reservedCount: Math.max(0, (usage.reservedCount ?? 0) - 1),
      updatedAtMs: now,
    });

    return {
      attachmentId: row._id,
      role: row.role,
      objectKey: row.objectKey,
      mimeType: args.actualMimeType,
      sizeBytes: args.actualSizeBytes,
      replacedObjectKeys: replaced.map((item) => item.objectKey),
    };
  },
});

export const cancelUpload = mutation({
  args: { attachmentId: v.id("tradeJournalAttachments") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const row = await ctx.db.get(args.attachmentId);
    if (!row || row.userId !== userId) return { success: true };
    if (row.status !== "pending") return { success: true };

    const usage = await getUsage(ctx, userId);
    await ctx.db.patch(row._id, { status: "deleted", updatedAtMs: Date.now() });
    if (usage) {
      await ctx.db.patch(usage._id, {
        reservedBytes: Math.max(0, (usage.reservedBytes ?? 0) - row.sizeBytes),
        reservedCount: Math.max(0, (usage.reservedCount ?? 0) - 1),
        updatedAtMs: Date.now(),
      });
    }
    return { success: true, objectKey: row.objectKey };
  },
});

export const deleteAttachment = mutation({
  args: { attachmentId: v.id("tradeJournalAttachments") },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const row = await ctx.db.get(args.attachmentId);
    if (!row || row.userId !== userId || row.status !== "ready") {
      throw new Error("Attachment not found");
    }
    await assertOwnedTrade(ctx, userId, row.tradeId);

    const usage = await getUsage(ctx, userId);
    await ctx.db.patch(row._id, { status: "deleted", updatedAtMs: Date.now() });
    if (usage) {
      await ctx.db.patch(usage._id, {
        usedBytes: Math.max(0, usage.usedBytes - row.sizeBytes),
        attachmentCount: Math.max(0, usage.attachmentCount - 1),
        updatedAtMs: Date.now(),
      });
    }
    return { success: true, objectKey: row.objectKey };
  },
});

export const getUsageForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireVerifiedAuthUserId(ctx);
    const usage = await getUsage(ctx, userId);
    return {
      usedBytes: usage?.usedBytes ?? 0,
      attachmentCount: usage?.attachmentCount ?? 0,
      reservedBytes: usage?.reservedBytes ?? 0,
      reservedCount: usage?.reservedCount ?? 0,
      limitBytes: FREE_STORAGE_BYTES,
      limitCount: FREE_ATTACHMENT_COUNT,
    };
  },
});
