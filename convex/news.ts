import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireVerifiedAuthUserId } from "./lib/auth";
import { economicEventWrite } from "./lib/economicEventMerge";
import { planCalendarAlert, SUBSCRIBER_ALERT_PAGE_SIZE } from "./lib/notificationStaging";
import { findOwnedOrOrphanProfile } from "./lib/profileOwnership";

const nullableStringArg = v.optional(v.union(v.string(), v.null()));
const nullableNumberArg = v.optional(v.union(v.number(), v.null()));

const toClientEvent = (row: any) => ({
  id: row._id,
  externalId: row.externalId,
  country: row.country,
  event: row.event,
  impact: row.impact,
  scheduledAtMs: row.scheduledAtMs,
  scheduledAt: new Date(row.scheduledAtMs).toISOString(),
  actual: row.actual ?? null,
  estimate: row.estimate ?? null,
  previous: row.previous ?? null,
  unit: row.unit ?? null,
  detailUrl: row.detailUrl ?? null,
});

const toClientSnapshot = (row: any) => ({
  key: row.key,
  label: row.label,
  kind: row.kind,
  rate: row.rate ?? null,
  bid: row.bid ?? null,
  ask: row.ask ?? null,
  changePercent: row.changePercent ?? null,
  meta: row.meta ?? null,
  updatedAt: new Date(row.updatedAtMs).toISOString(),
  updatedAtMs: row.updatedAtMs,
});

const EVENT_LIST_CAP = 500;
const KNOWN_IMPACTS = ["high", "medium", "low", "holiday"] as const;

function impactsForFilter(impact: string | null): readonly string[] {
  if (!impact || impact === "all") return KNOWN_IMPACTS;
  switch (impact) {
    case "high":
    case "medium":
    case "holiday":
      return [impact];
    case "low":
      return ["low", "holiday"];
    default: {
      const custom: string = impact;
      return [custom];
    }
  }
}

export const listEvents = query({
  args: {
    fromMs: v.number(),
    toMs: v.number(),
    impact: nullableStringArg,
    country: nullableStringArg,
    /** Client-only cache bust for manual refresh; ignored by the query body. */
    refreshToken: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    void args.refreshToken;
    const impact = args.impact?.toLowerCase() ?? null;
    const country = args.country?.toUpperCase() ?? null;
    const impacts = impactsForFilter(impact && impact !== "all" ? impact : null);

    const batches = await Promise.all(
      impacts.map((value) =>
        ctx.db
          .query("economicEvents")
          .withIndex("by_impact_scheduled", (q) =>
            q.eq("impact", value).gte("scheduledAtMs", args.fromMs).lte("scheduledAtMs", args.toMs),
          )
          .take(EVENT_LIST_CAP),
      ),
    );

    return batches
      .flat()
      .filter((row) => {
        if (country && country !== "ALL" && row.country.toUpperCase() !== country) return false;
        return true;
      })
      .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs)
      .map(toClientEvent);
  },
});

const SNAPSHOT_LIMIT = 200;
const FX_SYNC_SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "AUD/USD"] as const;

export const listSnapshots = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_key")
      .take(SNAPSHOT_LIMIT);
    return rows
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(toClientSnapshot);
  },
});

export const listSnapshotsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("marketSnapshots")
      .withIndex("by_key")
      .take(SNAPSHOT_LIMIT);
    return rows.map((row) => ({
      key: row.key,
      kind: row.kind,
    }));
  },
});

export const getIngestState = query({
  args: {
    refreshToken: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    void args.refreshToken;
    const row = await ctx.db
      .query("newsIngestState")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    // Do not expose raw lastError strings publicly (AP-014 / MC-034).
    return {
      lastIngestAtMs: row?.lastIngestAtMs ?? null,
      lastNewsCount: row?.lastNewsCount ?? null,
      hasError: Boolean(row?.lastError),
      updatedAtMs: row?.updatedAtMs ?? null,
    };
  },
});

export const getNewsAlertsEnabled = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true;

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (profile?.newsAlertsEnabled === false) return false;
    return true;
  },
});

export const setNewsAlertsEnabled = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireVerifiedAuthUserId(ctx);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    let profile = await findOwnedOrOrphanProfile(ctx.db, userId, user.email);

    const now = Date.now();
    if (profile) {
      await ctx.db.patch(profile._id, {
        externalUserId: userId,
        newsAlertsEnabled: args.enabled,
        updatedAtMs: now,
      });
    } else if (user.email) {
      await ctx.db.insert("profiles", {
        externalUserId: userId,
        email: user.email.trim().toLowerCase(),
        fullName: user.fullName ?? user.name ?? null,
        avatarUrl: user.avatarUrl ?? user.image ?? null,
        role: user.role ?? "user",
        paymentStatus: user.paymentStatus ?? "free",
        subscriptionTier: user.subscriptionTier ?? "free",
        subscriptionExpiresAtMs: user.subscriptionExpiresAtMs ?? null,
        newsAlertsEnabled: args.enabled,
        createdAtMs: now,
        updatedAtMs: now,
      });
    }

    return args.enabled;
  },
});

export const upsertEventsBatch = internalMutation({
  args: {
    events: v.array(
      v.object({
        externalId: v.string(),
        country: v.string(),
        event: v.string(),
        impact: v.string(),
        scheduledAtMs: v.number(),
        actual: nullableStringArg,
        estimate: nullableStringArg,
        previous: nullableStringArg,
        unit: nullableStringArg,
        detailUrl: nullableStringArg,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const inserted: Array<{
      id: string;
      event: string;
      country: string;
      impact: string;
      scheduledAtMs: number;
    }> = [];

    for (const item of args.events) {
      const existing = await ctx.db
        .query("economicEvents")
        .withIndex("by_external_id", (q) => q.eq("externalId", item.externalId))
        .unique();

      const payload = {
        country: item.country,
        event: item.event,
        impact: item.impact,
        scheduledAtMs: item.scheduledAtMs,
        actual: item.actual ?? null,
        estimate: item.estimate ?? null,
        previous: item.previous ?? null,
        unit: item.unit ?? null,
        detailUrl: item.detailUrl ?? null,
        ingestedAtMs: now,
      };

      const write = economicEventWrite(existing !== null);
      switch (write) {
        case "patch": {
          if (!existing) {
            throw new Error("Expected stored economic event");
          }
          await ctx.db.patch(existing._id, payload);
          break;
        }
        case "insert": {
          const id = await ctx.db.insert("economicEvents", {
            externalId: item.externalId,
            ...payload,
          });
          inserted.push({
            id,
            event: item.event,
            country: item.country,
            impact: item.impact,
            scheduledAtMs: item.scheduledAtMs,
          });
          break;
        }
        default: {
          const _exhaustive: never = write;
          throw new Error(`Unhandled economic event write: ${_exhaustive}`);
        }
      }
    }

    return { insertedCount: inserted.length, inserted };
  },
});

export const upsertSnapshotsBatch = internalMutation({
  args: {
    snapshots: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        kind: v.string(),
        rate: nullableNumberArg,
        bid: nullableNumberArg,
        ask: nullableNumberArg,
        changePercent: nullableNumberArg,
        meta: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const snapshot of args.snapshots) {
      const existing = await ctx.db
        .query("marketSnapshots")
        .withIndex("by_key", (q) => q.eq("key", snapshot.key))
        .unique();

      const payload = {
        key: snapshot.key,
        label: snapshot.label,
        kind: snapshot.kind,
        rate: snapshot.rate ?? null,
        bid: snapshot.bid ?? null,
        ask: snapshot.ask ?? null,
        changePercent: snapshot.changePercent ?? null,
        meta: snapshot.meta ?? null,
        updatedAtMs: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("marketSnapshots", payload);
      }
    }
    return { count: args.snapshots.length };
  },
});

export const syncFxFromPriceSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let count = 0;
    let written = 0;
    let skipped = 0;

    for (const symbol of FX_SYNC_SYMBOLS) {
      // Read the latest source row inside the mutation so Convex OCC prevents
      // an older ingest run from overwriting a newer price snapshot.
      const price = await ctx.db
        .query("priceSnapshots")
        .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
        .unique();
      if (!price) continue;
      count += 1;

      const key = symbol.replace("/", "");
      const existing = await ctx.db
        .query("marketSnapshots")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();

      const bid = price.bidPrice ?? null;
      const ask = price.askPrice ?? null;
      const existingSource =
        existing?.meta
        && typeof existing.meta === "object"
        && !Array.isArray(existing.meta)
        && "source" in existing.meta
          ? (existing.meta as { source?: unknown }).source
          : undefined;

      const unchanged = Boolean(
        existing
        && existing.label === symbol
        && existing.kind === "fx"
        && (existing.rate ?? null) === price.midPrice
        && (existing.bid ?? null) === bid
        && (existing.ask ?? null) === ask
        && (existing.changePercent ?? null) === null
        && existingSource === price.source,
      );

      if (unchanged) {
        skipped += 1;
        continue;
      }

      const payload = {
        key,
        label: symbol,
        kind: "fx",
        rate: price.midPrice,
        bid,
        ask,
        changePercent: null,
        meta: { source: price.source },
        updatedAtMs: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("marketSnapshots", payload);
      }
      written += 1;
    }

    return { count, written, skipped };
  },
});

export const claimIngest = internalMutation({
  args: {
    minIntervalMs: v.number(),
    leaseMs: v.number(),
    token: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("newsIngestState")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();

    if (
      !args.force
      && existing?.lastIngestAtMs
      && now - existing.lastIngestAtMs < args.minIntervalMs
    ) {
      return {
        acquired: false as const,
        reason: "min_interval" as const,
        lastIngestAtMs: existing.lastIngestAtMs,
      };
    }

    if (
      existing?.ingestLeaseUntilMs
      && existing.ingestLeaseUntilMs > now
      && existing.ingestLeaseToken
      && existing.ingestLeaseToken !== args.token
    ) {
      return {
        acquired: false as const,
        reason: "in_progress" as const,
        lastIngestAtMs: existing.lastIngestAtMs ?? null,
      };
    }

    const leaseUntilMs = now + Math.max(5_000, args.leaseMs);
    if (existing) {
      await ctx.db.patch(existing._id, {
        ingestLeaseUntilMs: leaseUntilMs,
        ingestLeaseToken: args.token,
        updatedAtMs: now,
      });
    } else {
      await ctx.db.insert("newsIngestState", {
        key: "primary",
        lastIngestAtMs: null,
        lastNewsCount: null,
        lastError: null,
        ingestLeaseUntilMs: leaseUntilMs,
        ingestLeaseToken: args.token,
        updatedAtMs: now,
      });
    }

    return {
      acquired: true as const,
      reason: null,
      lastIngestAtMs: existing?.lastIngestAtMs ?? null,
    };
  },
});

export const finishIngest = internalMutation({
  args: {
    token: v.string(),
    lastIngestAtMs: nullableNumberArg,
    lastNewsCount: nullableNumberArg,
    lastError: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("newsIngestState")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();

    if (!existing) return { applied: false };

    // If a newer ingest acquired the lease after this run expired, do not let
    // the older run clear or overwrite the newer run's state.
    if (
      existing.ingestLeaseToken
      && existing.ingestLeaseToken !== args.token
    ) {
      return { applied: false };
    }

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      ...(args.lastIngestAtMs !== undefined ? { lastIngestAtMs: args.lastIngestAtMs } : {}),
      ...(args.lastNewsCount !== undefined ? { lastNewsCount: args.lastNewsCount } : {}),
      ...(args.lastError !== undefined ? { lastError: args.lastError } : {}),
      ingestLeaseUntilMs: null,
      ingestLeaseToken: null,
      updatedAtMs: now,
    });

    return { applied: true };
  },
});

export const markIngestState = internalMutation({
  args: {
    lastIngestAtMs: nullableNumberArg,
    lastNewsCount: nullableNumberArg,
    lastError: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("newsIngestState")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();

    const payload = {
      key: "primary",
      ...(args.lastIngestAtMs !== undefined ? { lastIngestAtMs: args.lastIngestAtMs } : {}),
      ...(args.lastNewsCount !== undefined ? { lastNewsCount: args.lastNewsCount } : {}),
      ...(args.lastError !== undefined ? { lastError: args.lastError } : {}),
      updatedAtMs: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("newsIngestState", {
        key: "primary",
        lastIngestAtMs: args.lastIngestAtMs ?? null,
        lastNewsCount: args.lastNewsCount ?? null,
        lastError: args.lastError ?? null,
        updatedAtMs: now,
      });
    }

    return payload;
  },
});

export const queueHighImpactAlerts = internalMutation({
  args: {
    events: v.array(
      v.object({
        id: v.string(),
        event: v.string(),
        country: v.string(),
        scheduledAtMs: v.number(),
      }),
    ),
    eventIndex: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<{ queued: number; recipients: number; scheduledFollowUp: boolean }> => {
    const now = Date.now();
    const eventIndex = args.eventIndex ?? 0;
    const item = args.events[eventIndex];
    if (!item) {
      return { queued: 0, recipients: 0, scheduledFollowUp: false };
    }

    const plan = planCalendarAlert(item.scheduledAtMs, now);
    switch (plan.action) {
      case "skip": {
        const hasAnotherEvent = eventIndex + 1 < args.events.length;
        if (hasAnotherEvent) {
          await ctx.scheduler.runAfter(0, internal.news.queueHighImpactAlerts, {
            events: args.events,
            eventIndex: eventIndex + 1,
            cursor: null,
          });
        }
        return { queued: 0, recipients: 0, scheduledFollowUp: hasAnotherEvent };
      }
      case "send":
        break;
      default: {
        const _exhaustive: never = plan;
        throw new Error(`Unhandled calendar alert plan: ${JSON.stringify(_exhaustive)}`);
      }
    }

    const page = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .paginate({
        numItems: SUBSCRIBER_ALERT_PAGE_SIZE,
        cursor: args.cursor ?? null,
      });

    const emailed = new Set<string>();
    let queued = 0;
    let recipients = 0;
    const body = `${item.country} · ${item.event}`.slice(0, 160);

    for (const sub of page.page) {
      const userId = sub.userId;
      if (!sub.isActive || !userId) continue;

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
        .first();

      if (profile?.newsAlertsEnabled === false) continue;

      const pushTag = `calendar-${item.id}-${sub._id}`;
      const existingPush = await ctx.db
        .query("notificationQueue")
        .withIndex("by_tag", (q) => q.eq("tag", pushTag))
        .first();
      if (!existingPush) {
        await ctx.db.insert("notificationQueue", {
          userId,
          channel: "push",
          title: "High-impact event",
          body,
          status: "pending",
          recipientEmail: null,
          tag: pushTag,
          data: {
            type: "news",
            path: "/calendar",
            eventId: item.id,
            url: "/calendar",
            subscriptionId: sub._id,
          },
          scheduledForMs: plan.scheduledForMs,
          processingStartedAtMs: null,
          attempts: 0,
          errorMessage: null,
          createdAtMs: now,
          updatedAtMs: now,
        });
        queued += 1;
        recipients += 1;
      }

      const recipientEmail = profile?.email ?? null;
      if (!recipientEmail || emailed.has(userId)) continue;
      emailed.add(userId);

      const emailTag = `calendar-email-${item.id}-${userId}`;
      const existingEmail = await ctx.db
        .query("notificationQueue")
        .withIndex("by_tag", (q) => q.eq("tag", emailTag))
        .first();
      if (existingEmail) continue;

      await ctx.db.insert("notificationQueue", {
        userId,
        channel: "email",
        title: `High-impact: ${item.event.slice(0, 80)}`,
        body,
        status: "pending",
        recipientEmail,
        tag: emailTag,
        data: {
          type: "news",
          path: "/calendar",
          eventId: item.id,
          url: "/calendar",
        },
        scheduledForMs: plan.scheduledForMs,
        processingStartedAtMs: null,
        attempts: 0,
        errorMessage: null,
        createdAtMs: now,
        updatedAtMs: now,
      });
      queued += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.news.queueHighImpactAlerts, {
        events: args.events,
        eventIndex,
        cursor: page.continueCursor,
      });
      return { queued, recipients, scheduledFollowUp: true };
    }

    const hasAnotherEvent = eventIndex + 1 < args.events.length;
    if (hasAnotherEvent) {
      await ctx.scheduler.runAfter(0, internal.news.queueHighImpactAlerts, {
        events: args.events,
        eventIndex: eventIndex + 1,
        cursor: null,
      });
    }

    return { queued, recipients, scheduledFollowUp: hasAnotherEvent };
  },
});

/** Signed-in calendar visits pull the free Forex Factory feed. The ingest gate still collapses bursts. */
export const refreshCalendar = action({
  args: {
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    ok: true;
    skipped: boolean;
    reason?: string;
    lastIngestAtMs?: number | null;
    eventCount?: number;
    insertedCount?: number;
    highImpactCount?: number;
    alertsQueued?: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.runAction(internal.newsIngest.runIngest, {
      force: args.force ?? false,
    });
  },
});

export const shouldSkipIngest = internalQuery({
  args: {
    minIntervalMs: v.number(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("newsIngestState")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();

    if (!row?.lastIngestAtMs) {
      return { skip: false, lastIngestAtMs: null as number | null };
    }

    const age = Date.now() - row.lastIngestAtMs;
    return {
      skip: age < args.minIntervalMs,
      lastIngestAtMs: row.lastIngestAtMs,
      ageMs: age,
    };
  },
});
