import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { SUBSCRIBER_ALERT_PAGE_SIZE } from "./lib/notificationStaging";
import {
  isJournalLogReminderHour,
  journalLogReminderDeliveryKey,
  sessionAlertDeliveryKey,
  sessionOpenDueAt,
  utcDateKey,
} from "./lib/tradingSessionAlerts";

const JOURNAL_REMINDER_PAGE_SIZE = 25;

/**
 * Fire once when a UTC forex session opens. Idempotent via notification tag + deliveryKey.
 */
export const enqueueDueSessionAlert = internalMutation({
  args: {
    nowMs: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<{ queued: number; sessionId: string | null; scheduledFollowUp: boolean }> => {
    const now = args.nowMs ?? Date.now();
    const session = sessionOpenDueAt(now);
    if (!session) {
      return { queued: 0, sessionId: null, scheduledFollowUp: false };
    }

    const dayKey = utcDateKey(now);
    const deliveryKey = sessionAlertDeliveryKey(session.id, dayKey);
    const title = `${session.label} open`;
    const body = `${session.label} is open (UTC). Review the calendar before you trade.`;

    const page = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .paginate({
        numItems: SUBSCRIBER_ALERT_PAGE_SIZE,
        cursor: args.cursor ?? null,
      });

    let queued = 0;
    for (const sub of page.page) {
      if (!sub.isActive || !sub.userId) continue;

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", sub.userId!))
        .first();
      if (profile?.tradingSessionAlertsEnabled === false) continue;

      const tag = `session-${deliveryKey}-${sub._id}`;
      const existing = await ctx.db
        .query("notificationQueue")
        .withIndex("by_tag", (q) => q.eq("tag", tag))
        .first();
      if (existing) continue;

      await ctx.db.insert("notificationQueue", {
        userId: sub.userId,
        channel: "push",
        title,
        body,
        status: "pending",
        recipientEmail: null,
        tag,
        data: {
          type: "trading_session",
          path: "/calendar",
          sessionId: session.id,
          url: "/calendar",
          subscriptionId: sub._id,
          displayTag: `session-${session.id}`,
        },
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
      await ctx.scheduler.runAfter(0, internal.tradingSessionNotifications.enqueueDueSessionAlert, {
        nowMs: now,
        cursor: page.continueCursor,
      });
      return { queued, sessionId: session.id, scheduledFollowUp: true };
    }

    return { queued, sessionId: session.id, scheduledFollowUp: false };
  },
});

/**
 * Evening nudge to log trades. Uses each profile timezone (falls back to UTC).
 * Pages active push devices; skips users who already logged a trade that local day.
 */
export const enqueueDueJournalLogReminders = internalMutation({
  args: {
    nowMs: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<{ queued: number; checked: number; scheduledFollowUp: boolean }> => {
    const now = args.nowMs ?? Date.now();
    const page = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .paginate({
        numItems: JOURNAL_REMINDER_PAGE_SIZE,
        cursor: args.cursor ?? null,
      });

    let queued = 0;
    let checked = 0;
    const seenUsers = new Set<string>();

    for (const sub of page.page) {
      if (!sub.isActive || !sub.userId) continue;
      if (seenUsers.has(sub.userId)) continue;
      seenUsers.add(sub.userId);
      checked += 1;

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", sub.userId!))
        .first();
      if (profile?.journalLogRemindersEnabled === false) continue;

      const { due, dayKey } = isJournalLogReminderHour(now, profile?.timezone ?? null);
      if (!due) continue;

      const deliveryKey = journalLogReminderDeliveryKey(sub.userId, dayKey);
      const userSubs = await ctx.db
        .query("pushSubscriptions")
        .withIndex("by_user_active", (q) => q.eq("userId", sub.userId!).eq("isActive", true))
        .take(20);
      if (userSubs.length === 0) continue;

      // Already nudged this local day on any device.
      let alreadyQueued = false;
      for (const device of userSubs) {
        const deviceTag = `journal-log-${deliveryKey}-push-${device._id}`;
        const existingDevice = await ctx.db
          .query("notificationQueue")
          .withIndex("by_tag", (q) => q.eq("tag", deviceTag))
          .first();
        if (existingDevice) {
          alreadyQueued = true;
          break;
        }
      }
      if (alreadyQueued) continue;

      // Any trade created on the local calendar day counts as "logged".
      const dayStartGuess = now - 36 * 60 * 60 * 1000;
      const recent = await ctx.db
        .query("tradingJournal")
        .withIndex("by_user_created", (q) => q.eq("userId", sub.userId!).gte("createdAtMs", dayStartGuess))
        .take(40);
      const loggedToday = recent.some((trade) => {
        const zone = profile?.timezone?.trim() || "UTC";
        try {
          const tradeDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: zone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(trade.createdAtMs));
          return tradeDay === dayKey;
        } catch {
          return utcDateKey(trade.createdAtMs) === dayKey;
        }
      });
      if (loggedToday) continue;

      for (const device of userSubs) {
        const deviceTag = `journal-log-${deliveryKey}-push-${device._id}`;
        await ctx.db.insert("notificationQueue", {
          userId: sub.userId,
          channel: "push",
          title: "Log today's trades",
          body: "Quick journal entry keeps your edge measurable. Open Poscal and log what you traded.",
          status: "pending",
          recipientEmail: null,
          tag: deviceTag,
          data: {
            type: "journal_log_reminder",
            path: "/journal",
            url: "/journal",
            subscriptionId: device._id,
            displayTag: "journal-log",
          },
          scheduledForMs: null,
          processingStartedAtMs: null,
          attempts: 0,
          errorMessage: null,
          createdAtMs: now,
          updatedAtMs: now,
        });
        queued += 1;
      }
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.tradingSessionNotifications.enqueueDueJournalLogReminders, {
        nowMs: now,
        cursor: page.continueCursor,
      });
      return { queued, checked, scheduledFollowUp: true };
    }

    return { queued, checked, scheduledFollowUp: false };
  },
});
