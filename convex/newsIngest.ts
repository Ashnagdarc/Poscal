"use node";

import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const MIN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const FEEDS = [
  "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
] as const;

type FfEconomicEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
};

const toDisplay = (value: string | null | undefined) => {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeImpact = (raw?: string) => {
  const value = (raw ?? "low").toLowerCase();
  if (value === "high") return "high";
  if (value === "medium") return "medium";
  if (value === "holiday") return "holiday";
  return "low";
};

const parseScheduledAtMs = (raw?: string) => {
  if (!raw) return Date.now();
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : Date.now();
};

const hashExternalId = (country: string, event: string, date: string) => {
  const input = `${country}|${event}|${date}`;
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `ff-${Math.abs(hash)}`;
};

async function fetchFeed(url: string): Promise<FfEconomicEvent[]> {
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "PoscalCalendarBot/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Calendar feed HTTP ${response.status}`);
  }
  const json = (await response.json()) as unknown;
  return Array.isArray(json) ? (json as FfEconomicEvent[]) : [];
}

export const runIngest = internalAction({
  args: {
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    if (!args.force) {
      const gate = await ctx.runQuery(internal.news.shouldSkipIngest, {
        minIntervalMs: MIN_INTERVAL_MS,
      });
      if (gate.skip) {
        return {
          ok: true,
          skipped: true,
          reason: "min_interval",
          lastIngestAtMs: gate.lastIngestAtMs ?? null,
        };
      }
    }

    try {
      await ctx.runMutation(internal.news.syncFxFromPriceSnapshots, {});

      const feeds = await Promise.all(FEEDS.map((url) => fetchFeed(url)));
      const feed = feeds.flat();

      const events = feed
        .filter((item) => item.title && item.date)
        .map((item) => {
          const country = (item.country ?? "XX").toUpperCase();
          const event = item.title!;
          const date = item.date!;
          return {
            externalId: hashExternalId(country, event, date),
            country,
            event,
            impact: normalizeImpact(item.impact),
            scheduledAtMs: parseScheduledAtMs(date),
            actual: toDisplay(item.actual),
            estimate: toDisplay(item.forecast),
            previous: toDisplay(item.previous),
            unit: null as string | null,
          };
        });

      // De-dupe by externalId within this batch.
      const unique = new Map<string, (typeof events)[number]>();
      for (const item of events) {
        unique.set(item.externalId, item);
      }
      const deduped = Array.from(unique.values());

      const upserted = await ctx.runMutation(internal.news.upsertEventsBatch, {
        events: deduped,
      });

      const now = Date.now();
      const upcomingHighImpact = (upserted.inserted ?? []).filter((item) => {
        if (item.impact !== "high") return false;
        return item.scheduledAtMs >= now && item.scheduledAtMs <= now + 48 * 60 * 60 * 1000;
      });

      let alertsQueued = 0;
      if (upcomingHighImpact.length > 0) {
        const queued = await ctx.runMutation(internal.news.queueHighImpactAlerts, {
          events: upcomingHighImpact.map((item) => ({
            id: item.id,
            event: item.event,
            country: item.country,
            scheduledAtMs: item.scheduledAtMs,
          })),
        });
        alertsQueued = queued.queued;
      }

      await ctx.runMutation(internal.news.markIngestState, {
        lastIngestAtMs: Date.now(),
        lastNewsCount: deduped.length,
        lastError: null,
      });

      return {
        ok: true,
        skipped: false,
        eventCount: deduped.length,
        insertedCount: upserted.insertedCount,
        highImpactCount: upcomingHighImpact.length,
        alertsQueued,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown ingest error";
      await ctx.runMutation(internal.news.markIngestState, {
        lastIngestAtMs: undefined,
        lastNewsCount: undefined,
        lastError: message,
      });
      throw error;
    }
  },
});
