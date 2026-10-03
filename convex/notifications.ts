import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { selectClaimBatch, SUBSCRIBER_ALERT_PAGE_SIZE } from "./lib/notificationStaging";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";

const MAX_NOTIFICATION_ATTEMPTS = 3;
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
    // Cap scans so a large backlog cannot blow read limits; claim only needs a batch.
    const scanCap = Math.max(args.limit * 4, 40);
    const [pending, processing] = await Promise.all([
      ctx.db
        .query("notificationQueue")
        .withIndex("by_status_scheduled", (q) => q.eq("status", "pending"))
        .take(scanCap),
      ctx.db
        .query("notificationQueue")
        .withIndex("by_status_scheduled", (q) => q.eq("status", "processing"))
        .take(scanCap),
    ]);

    const { claim: candidates } = selectClaimBatch({
      pending,
      processing,
      now,
      limit: args.limit,
      staleAfterMs: args.staleAfterMs,
    });

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

export const getPushSubscription = internalQuery({
  args: {
    id: v.id("pushSubscriptions"),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row?.isActive) return null;
    return {
      _id: row._id,
      endpoint: row.endpoint,
      p256dhKey: row.p256dhKey,
      authKey: row.authKey,
    };
  },
});

/** One queue row per device. A later page continues until every active device has a row. */
export const enqueueDevicePushes = internalMutation({
  args: {
    userId: nullableStringArg,
    title: v.string(),
    body: v.string(),
    tag: v.string(),
    deliveryKey: v.string(),
    data: nullableAnyArg,
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<{ queued: number; scheduledFollowUp: boolean }> => {
    const now = Date.now();
    const baseData = args.data && typeof args.data === "object" ? args.data : {};

    if (args.userId) {
      const rows = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user_active", (q) => q.eq("userId", args.userId!).eq("isActive", true))
        .take(20);
      let queued = 0;
      for (const sub of rows) {
        const tag = `${args.tag}-${args.deliveryKey}-${sub._id}`;
        const existing = await ctx.db
          .query("notificationQueue")
          .withIndex("by_tag", (q) => q.eq("tag", tag))
          .first();
        if (existing) continue;
        await ctx.db.insert("notificationQueue", {
          userId: sub.userId,
          channel: "push",
          title: args.title,
          body: args.body,
          status: "pending",
          recipientEmail: null,
          tag,
          data: { ...baseData, subscriptionId: sub._id, displayTag: args.tag },
          scheduledForMs: null,
          processingStartedAtMs: null,
          attempts: 0,
          errorMessage: null,
          createdAtMs: now,
          updatedAtMs: now,
        });
        queued += 1;
      }
      return { queued, scheduledFollowUp: false };
    }

    const page = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .paginate({ numItems: SUBSCRIBER_ALERT_PAGE_SIZE, cursor: args.cursor ?? null });

    let queued = 0;
    for (const sub of page.page) {
      if (!sub.isActive) continue;
      const tag = `${args.tag}-${args.deliveryKey}-${sub._id}`;
      const existing = await ctx.db
        .query("notificationQueue")
        .withIndex("by_tag", (q) => q.eq("tag", tag))
        .first();
      if (existing) continue;
      await ctx.db.insert("notificationQueue", {
        userId: sub.userId,
        channel: "push",
        title: args.title,
        body: args.body,
        status: "pending",
        recipientEmail: null,
        tag,
        data: { ...baseData, subscriptionId: sub._id, displayTag: args.tag },
        scheduledForMs: null,
        processingStartedAtMs: null,
        attempts: 0,
        errorMessage: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      queued += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.notifications.enqueueDevicePushes, {
        userId: null,
        title: args.title,
        body: args.body,
        tag: args.tag,
        deliveryKey: args.deliveryKey,
        data: args.data ?? null,
        cursor: page.continueCursor,
      });
    }

    return { queued, scheduledFollowUp: !page.isDone };
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

    const user = await ctx.db.get(args.userId as Id<"users">);
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
    retryable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      return { success: false, retried: false };
    }

    const attempts = existing.attempts + 1;
    const retry =
      args.status === "failed" &&
      args.retryable === true &&
      attempts < MAX_NOTIFICATION_ATTEMPTS;
    const now = Date.now();

    await ctx.db.patch(args.id, {
      status: retry ? "pending" : args.status,
      processingStartedAtMs: null,
      attempts,
      errorMessage: args.errorMessage ?? null,
      scheduledForMs: retry ? now + attempts * 60_000 : existing.scheduledForMs,
      updatedAtMs: now,
    });

    return { success: true, retried: retry, attempts };
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
