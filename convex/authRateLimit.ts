import { v } from "convex/values";

import { internalMutation, internalQuery } from "./_generated/server";

const AUTH_ATTEMPT_WINDOWS = {
  signIn: { max: 10, windowMs: 15 * 60 * 1000 },
  signUp: { max: 5, windowMs: 60 * 60 * 1000 },
  reset: { max: 5, windowMs: 60 * 60 * 1000 },
} as const;

const EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_MIN_INTERVAL_MS = 60 * 1000;
const EMAIL_MAX_PER_WINDOW = 5;
const AUTH_EMAIL_DAILY_MAX = 240;

const emailKind = v.union(v.literal("verification"), v.literal("reset"));
type EmailKind = "verification" | "reset";
type AuthAttemptAction = keyof typeof AUTH_ATTEMPT_WINDOWS;

const authAttemptAction = v.union(
  v.literal("signIn"),
  v.literal("signUp"),
  v.literal("reset"),
);

const attemptLimitResult = v.object({
  ok: v.boolean(),
  remaining: v.number(),
  retryAfterMs: v.number(),
  message: v.optional(v.string()),
});

const limitResult = v.object({
  ok: v.boolean(),
  remaining: v.number(),
  retryAfterMs: v.number(),
  reason: v.union(
    v.literal("allowed"),
    v.literal("cooldown"),
    v.literal("email_limit"),
    v.literal("daily_limit"),
  ),
});

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const attemptRateKey = (action: AuthAttemptAction, email: string) =>
  `auth:${action}:${normalizeEmail(email)}`;
const emailRateKey = (kind: EmailKind, email: string) =>
  `auth-email:${kind}:${normalizeEmail(email)}`;
const globalRateKey = (now: number) =>
  `auth-email:global:${new Date(now).toISOString().slice(0, 10)}`;

/**
 * Existing application-layer auth attempt limiter kept for server-side callers.
 * Convex Auth also applies its own credential and OTP attempt protections.
 */
export const consume = internalMutation({
  args: {
    action: authAttemptAction,
    email: v.string(),
  },
  returns: attemptLimitResult,
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email || !email.includes("@")) {
      throw new Error("Enter a valid email address");
    }

    const config = AUTH_ATTEMPT_WINDOWS[args.action];
    const key = attemptRateKey(args.action, email);
    const now = Date.now();
    const existing = await ctx.db
      .query("appAuthRateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!existing || now - existing.windowStartMs >= config.windowMs) {
      if (existing) {
        await ctx.db.patch(existing._id, {
          count: 1,
          windowStartMs: now,
          updatedAtMs: now,
        });
      } else {
        await ctx.db.insert("appAuthRateLimits", {
          key,
          action: args.action,
          email,
          count: 1,
          windowStartMs: now,
          updatedAtMs: now,
        });
      }
      return {
        ok: true,
        remaining: config.max - 1,
        retryAfterMs: 0,
      };
    }

    if (existing.count >= config.max) {
      const retryAfterMs = Math.max(
        0,
        config.windowMs - (now - existing.windowStartMs),
      );
      return {
        ok: false,
        remaining: 0,
        retryAfterMs,
        message: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 60_000)} minute(s).`,
      };
    }

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      updatedAtMs: now,
    });
    return {
      ok: true,
      remaining: config.max - (existing.count + 1),
      retryAfterMs: 0,
    };
  },
});

export const reset = internalMutation({
  args: {
    action: authAttemptAction,
    email: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const key = attemptRateKey(args.action, args.email);
    const existing = await ctx.db
      .query("appAuthRateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});

export const verificationRecipient = internalQuery({
  args: { email: v.string() },
  returns: v.object({
    alreadyVerified: v.boolean(),
    name: v.string(),
  }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return {
      alreadyVerified: user?.emailVerificationTime !== undefined,
      name: (user?.fullName ?? user?.name ?? "").trim(),
    };
  },
});

/**
 * Server-enforced outbound auth-email budget.
 *
 * Each address gets at most one email per minute and five per hour. The app
 * also reserves 60 of Brevo's 300 free daily sends for notifications and
 * operational recovery by stopping auth email sends at 240 per UTC day.
 */
export const consumeEmailSend = internalMutation({
  args: {
    kind: emailKind,
    email: v.string(),
  },
  returns: limitResult,
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email || !email.includes("@")) {
      throw new Error("Enter a valid email address");
    }

    const now = Date.now();
    const emailKey = emailRateKey(args.kind, email);
    const dayKey = globalRateKey(now);
    const [emailLimit, globalLimit] = await Promise.all([
      ctx.db.query("appAuthRateLimits").withIndex("by_key", (q) => q.eq("key", emailKey)).unique(),
      ctx.db.query("appAuthRateLimits").withIndex("by_key", (q) => q.eq("key", dayKey)).unique(),
    ]);

    if (globalLimit && globalLimit.count >= AUTH_EMAIL_DAILY_MAX) {
      const date = new Date(now);
      const nextUtcDay = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
      );
      return {
        ok: false,
        remaining: 0,
        retryAfterMs: Math.max(0, nextUtcDay - now),
        reason: "daily_limit" as const,
      };
    }

    const emailWindowActive =
      emailLimit !== null && now - emailLimit.windowStartMs < EMAIL_WINDOW_MS;
    if (emailWindowActive && now - emailLimit.updatedAtMs < EMAIL_MIN_INTERVAL_MS) {
      return {
        ok: false,
        remaining: Math.max(0, EMAIL_MAX_PER_WINDOW - emailLimit.count),
        retryAfterMs: EMAIL_MIN_INTERVAL_MS - (now - emailLimit.updatedAtMs),
        reason: "cooldown" as const,
      };
    }
    if (emailWindowActive && emailLimit.count >= EMAIL_MAX_PER_WINDOW) {
      return {
        ok: false,
        remaining: 0,
        retryAfterMs: Math.max(0, EMAIL_WINDOW_MS - (now - emailLimit.windowStartMs)),
        reason: "email_limit" as const,
      };
    }

    const nextEmailCount = emailWindowActive ? emailLimit.count + 1 : 1;
    if (emailLimit) {
      await ctx.db.patch(emailLimit._id, {
        count: nextEmailCount,
        windowStartMs: emailWindowActive ? emailLimit.windowStartMs : now,
        updatedAtMs: now,
      });
    } else {
      await ctx.db.insert("appAuthRateLimits", {
        key: emailKey,
        action: args.kind,
        email,
        count: 1,
        windowStartMs: now,
        updatedAtMs: now,
      });
    }

    if (globalLimit) {
      await ctx.db.patch(globalLimit._id, {
        count: globalLimit.count + 1,
        updatedAtMs: now,
      });
    } else {
      await ctx.db.insert("appAuthRateLimits", {
        key: dayKey,
        action: "emailGlobal",
        email: "global",
        count: 1,
        windowStartMs: now,
        updatedAtMs: now,
      });
    }

    return {
      ok: true,
      remaining: Math.min(
        EMAIL_MAX_PER_WINDOW - nextEmailCount,
        AUTH_EMAIL_DAILY_MAX - ((globalLimit?.count ?? 0) + 1),
      ),
      retryAfterMs: 0,
      reason: "allowed" as const,
    };
  },
});

/** Cascade delete per-email rate-limit rows on account erasure. */
export const clearForEmail = internalMutation({
  args: { email: v.string() },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) return { deleted: 0 };

    const keys = [
      emailRateKey("verification", email),
      emailRateKey("reset", email),
      ...Object.keys(AUTH_ATTEMPT_WINDOWS).map((action) =>
        attemptRateKey(action as AuthAttemptAction, email)),
    ];
    let deleted = 0;
    for (const key of keys) {
      const existing = await ctx.db
        .query("appAuthRateLimits")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (existing) {
        await ctx.db.delete(existing._id);
        deleted += 1;
      }
    }
    return { deleted };
  },
});
