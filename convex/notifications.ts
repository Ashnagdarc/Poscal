import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));
const nullableAnyArg = v.optional(v.union(v.any(), v.null()));

export const claimPendingBatch = internalMutation({
  args: {
    limit: v.number(),
    staleAfterMs: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const duePending = await ctx.db
      .query("notificationQueue")
      .withIndex("by_status_scheduled", (q) => q.eq("status", "pending"))
      .collect();

    const staleProcessing = await ctx.db
      .query("notificationQueue")
      .withIndex("by_status_scheduled", (q) => q.eq("status", "processing"))
      .collect();

    const candidates = [
      ...duePending.filter((row) => row.scheduledForMs === null || row.scheduledForMs === undefined || row.scheduledForMs <= now),
      ...staleProcessing.filter(
        (row) =>
          row.processingStartedAtMs !== null &&
          row.processingStartedAtMs !== undefined &&
          row.processingStartedAtMs <= now - args.staleAfterMs,
      ),
    ]
      .sort((left, right) => left.createdAtMs - right.createdAtMs)
      .slice(0, args.limit);

    for (const row of candidates) {
      await ctx.db.patch(row._id, {
        status: "processing",
        processingStartedAtMs: now,
        updatedAtMs: now,
        errorMessage: null,
      });
    }

    return candidates.map((row) => ({
      ...row,
      status: "processing" as const,
      processingStartedAtMs: now,
      updatedAtMs: now,
      errorMessage: null,
    }));
  },
});

export const listActivePushSubscriptions = internalQuery({
  args: {
    userId: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const rows = args.userId
      ? await ctx.db
          .query("pushSubscriptions")
          .withIndex("by_user", (q) => q.eq("userId", args.userId!))
          .collect()
      : await ctx.db.query("pushSubscriptions").collect();

    return rows.filter((row) => row.isActive);
  },
});

export const getUserEmail = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", args.userId))
      .first();

    if (profile?.email) {
      return profile.email;
    }

    const user = await ctx.db.get(args.userId as any);
    return user?.email ?? null;
  },
});

export const markSubscriptionInactive = internalMutation({
  args: {
    id: v.id("pushSubscriptions"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      return { success: false };
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAtMs: Date.now(),
    });

    return { success: true };
  },
});

export const finalizeNotification = internalMutation({
  args: {
    id: v.id("notificationQueue"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    errorMessage: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      return { success: false };
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      processingStartedAtMs: null,
      attempts: existing.attempts + 1,
      errorMessage: args.errorMessage ?? null,
      updatedAtMs: Date.now(),
    });

    return { success: true };
  },
});

export const queueEmail = mutation({
  args: {
    userId: nullableStringArg,
    recipientEmail: nullableStringArg,
    subject: v.string(),
    body: v.string(),
    html: nullableStringArg,
    fromEmail: nullableStringArg,
    scheduledForMs: nullableNumberArg,
    data: nullableAnyArg,
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.admin.requireAdminForInternal, {});

    const id = await ctx.db.insert("notificationQueue", {
      userId: args.userId ?? null,
      channel: "email",
      title: args.subject,
      body: args.body,
      status: "pending",
      recipientEmail: args.recipientEmail ?? null,
      tag: null,
      data: {
        ...(args.data ?? {}),
        html: args.html ?? null,
        fromEmail: args.fromEmail ?? null,
      },
      scheduledForMs: args.scheduledForMs ?? null,
      processingStartedAtMs: null,
      attempts: 0,
      errorMessage: null,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });

    return { id, success: true };
  },
});
