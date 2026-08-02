import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

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

export const listEvents = query({
  args: {
    fromMs: v.number(),
    toMs: v.number(),
    impact: nullableStringArg,
    country: nullableStringArg,
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("economicEvents")
      .withIndex("by_scheduled", (q) =>
        q.gte("scheduledAtMs", args.fromMs).lte("scheduledAtMs", args.toMs),
      )
      .take(500);

    const impact = args.impact?.toLowerCase() ?? null;
    const country = args.country?.toUpperCase() ?? null;

    return rows
      .filter((row) => {
        if (impact && impact !== "all" && row.impact.toLowerCase() !== impact) return false;
        if (country && country !== "ALL" && row.country.toUpperCase() !== country) return false;
        return true;
      })
      .sort((a, b) => a.scheduledAtMs - b.scheduledAtMs)
      .map(toClientEvent);
  },
});

export const listSnapshots = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("marketSnapshots").collect();
    return rows
      .sort((a, b) => a.key.localeCompare(b.key))
      .map(toClientSnapshot);
  },
});

export const listSnapshotsInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("marketSnapshots").collect();
    return rows.map((row) => ({
      key: row.key,
      kind: row.kind,
    }));
  },
});

export const getIngestState = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db
      .query("newsIngestState")
      .withIndex("by_key", (q) => q.eq("key", "primary"))
      .unique();
    return {
      lastIngestAtMs: row?.lastIngestAtMs ?? null,
      lastNewsCount: row?.lastNewsCount ?? null,
      lastError: row?.lastError ?? null,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    let profile = await ctx.db
      .query("profiles")
      .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
      .first();

    if (!profile && user.email) {
      profile = await ctx.db
        .query("profiles")
        .withIndex("by_email", (q) => q.eq("email", user.email!.trim().toLowerCase()))
        .first();
    }

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
        ingestedAtMs: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
        continue;
      }

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
    const symbols = ["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD", "AUD/USD"];
    const now = Date.now();
    let count = 0;

    for (const symbol of symbols) {
      const price = await ctx.db
        .query("priceSnapshots")
        .withIndex("by_symbol", (q) => q.eq("symbol", symbol))
        .unique();
      if (!price) continue;

      const key = symbol.replace("/", "");
      const existing = await ctx.db
        .query("marketSnapshots")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();

      const payload = {
        key,
        label: symbol,
        kind: "fx",
        rate: price.midPrice,
        bid: price.bidPrice ?? null,
        ask: price.askPrice ?? null,
        changePercent: null,
        meta: { source: price.source },
        updatedAtMs: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, payload);
      } else {
        await ctx.db.insert("marketSnapshots", payload);
      }
      count += 1;
    }

    return { count };
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const activeSubs = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_endpoint")
      .collect();

    const optedInUsers = new Map<string, string | null>();
    for (const sub of activeSubs) {
      if (!sub.isActive || !sub.userId) continue;
      if (optedInUsers.has(sub.userId)) continue;

      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_external_user_id", (q) => q.eq("externalUserId", sub.userId))
        .first();

      if (profile?.newsAlertsEnabled === false) continue;
      optedInUsers.set(sub.userId, profile?.email ?? null);
    }

    let queued = 0;
    for (const item of args.events.slice(0, 3)) {
      for (const [userId, recipientEmail] of optedInUsers) {
        const body = `${item.country} · ${item.event}`.slice(0, 160);
        await ctx.db.insert("notificationQueue", {
          userId,
          channel: "push",
          title: "High-impact event",
          body,
          status: "pending",
          recipientEmail: null,
          tag: `calendar-${item.id}-${userId}`,
          data: {
            type: "news",
            path: "/calendar",
            eventId: item.id,
            url: "/calendar",
          },
          scheduledForMs: null,
          processingStartedAtMs: null,
          attempts: 0,
          errorMessage: null,
          createdAtMs: now,
          updatedAtMs: now,
        });
        queued += 1;

        if (recipientEmail) {
          await ctx.db.insert("notificationQueue", {
            userId,
            channel: "email",
            title: `High-impact: ${item.event.slice(0, 80)}`,
            body,
            status: "pending",
            recipientEmail,
            tag: `calendar-email-${item.id}-${userId}`,
            data: {
              type: "news",
              path: "/calendar",
              eventId: item.id,
              url: "/calendar",
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
    }

    return { queued, recipients: optedInUsers.size };
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
