import { v } from "convex/values";

import { mutation } from "./_generated/server";

/**
 * Application-layer auth attempt limiter (AIS-009).
 * Complements Convex Auth's built-in OTP/password rate table.
 *
 * Limits (per email key, fixed window):
 * - signIn:  10 attempts / 15 minutes
 * - signUp:  5 attempts / hour
 * - reset:   5 attempts / hour
 */

const WINDOWS = {
  signIn: { max: 10, windowMs: 15 * 60 * 1000 },
  signUp: { max: 5, windowMs: 60 * 60 * 1000 },
  reset: { max: 5, windowMs: 60 * 60 * 1000 },
} as const;

type AuthAction = keyof typeof WINDOWS;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const rateKey = (action: AuthAction, email: string) =>
  `auth:${action}:${normalizeEmail(email)}`;

export const consume = mutation({
  args: {
    action: v.union(v.literal("signIn"), v.literal("signUp"), v.literal("reset")),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email || !email.includes("@")) {
      throw new Error("Enter a valid email address");
    }

    const config = WINDOWS[args.action];
    const key = rateKey(args.action, email);
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
        ok: true as const,
        remaining: config.max - 1,
        retryAfterMs: 0,
      };
    }

    if (existing.count >= config.max) {
      const retryAfterMs = Math.max(0, config.windowMs - (now - existing.windowStartMs));
      return {
        ok: false as const,
        remaining: 0,
        retryAfterMs,
        message: `Too many attempts. Try again in ${Math.ceil(retryAfterMs / 60000)} minute(s).`,
      };
    }

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      updatedAtMs: now,
    });

    return {
      ok: true as const,
      remaining: config.max - (existing.count + 1),
      retryAfterMs: 0,
    };
  },
});

export const reset = mutation({
  args: {
    action: v.union(v.literal("signIn"), v.literal("signUp"), v.literal("reset")),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const key = rateKey(args.action, normalizeEmail(args.email));
    const existing = await ctx.db
      .query("appAuthRateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true as const };
  },
});
