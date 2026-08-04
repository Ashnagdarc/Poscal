import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import { ResendOTP } from "./ResendOTP";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";
import { isEmailVerificationRequired } from "./lib/emailVerificationPolicy";

const MIN_PASSWORD_LENGTH = 10;

/*
 * Email verification kill-switch (Resend free tier):
 * - Default OFF via REQUIRE_EMAIL_VERIFICATION unset/false → no Password `verify`
 *   provider; sign-up/sign-in issue sessions without OTP (OTP code paths stay in repo).
 * - Set REQUIRE_EMAIL_VERIFICATION=true (or "1") in Convex env + redeploy to re-enable
 *   hard verification (MC-010) after paid Resend.
 *   npx convex env set REQUIRE_EMAIL_VERIFICATION true
 */
const requireEmailVerification = isEmailVerificationRequired();

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: ResendOTPPasswordReset,
      // Only attach when hard gate is ON. Convex Auth Password treats any `verify`
      // provider as mandatory for sign-up / unverified sign-in (blocks session until OTP).
      ...(requireEmailVerification ? { verify: ResendOTP } : {}),
      validatePasswordRequirements: (password: string) => {
        if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
          throw new ConvexError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        }
        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          throw new ConvexError("Password must include at least one letter and one number.");
        }
      },
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const rawName = typeof params.name === "string" ? params.name.trim() : "";

        return {
          email,
          ...(rawName ? { name: rawName, fullName: rawName } : {}),
          role: "user",
          paymentStatus: "free",
          subscriptionTier: "free",
          subscriptionExpiresAtMs: null,
          avatarUrl: null,
          image: null,
        };
      },
    }),
  ],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, args) {
      const user = await ctx.db.get(args.userId);
      if (!user?.email) {
        return;
      }

      const email = user.email.trim().toLowerCase();
      // Auth callback ctx is loosely typed relative to the app schema; cast for profile indexes.
      const db = ctx.db as any;
      const byUserId = await db
        .query("profiles")
        .withIndex("by_external_user_id", (q: any) => q.eq("externalUserId", args.userId))
        .first();
      const byEmail = await db
        .query("profiles")
        .withIndex("by_email", (q: any) => q.eq("email", email))
        .first();

      // Prefer legacy email-linked profile (may hold uploaded avatar_url from Nest/Postgres).
      const legacy = byEmail && byEmail._id !== byUserId?._id ? byEmail : null;
      const source = legacy ?? byUserId;

      const avatarUrl =
        user.avatarUrl ??
        user.image ??
        source?.avatarUrl ??
        null;

      const payload = {
        externalUserId: args.userId,
        email,
        fullName: user.fullName ?? user.name ?? source?.fullName ?? null,
        avatarUrl,
        role: user.role ?? source?.role ?? "user",
        paymentStatus: user.paymentStatus ?? source?.paymentStatus ?? "free",
        subscriptionTier: user.subscriptionTier ?? source?.subscriptionTier ?? "free",
        subscriptionExpiresAtMs:
          user.subscriptionExpiresAtMs ?? source?.subscriptionExpiresAtMs ?? null,
        updatedAtMs: Date.now(),
      };

      // Keep auth user avatar in sync so viewer() also returns it.
      if (avatarUrl && (user.avatarUrl !== avatarUrl || user.image !== avatarUrl)) {
        await ctx.db.patch(args.userId, {
          avatarUrl,
          image: avatarUrl,
        });
      }

      if (legacy) {
        await ctx.db.patch(legacy._id, payload);
        // Drop empty duplicate created under the new Convex auth id.
        if (byUserId && byUserId._id !== legacy._id) {
          await ctx.db.delete(byUserId._id);
        }
        return;
      }

      if (byUserId) {
        await ctx.db.patch(byUserId._id, {
          ...payload,
          // Never wipe an existing avatar with null on routine auth updates.
          avatarUrl: avatarUrl ?? byUserId.avatarUrl ?? null,
        });
        return;
      }

      await ctx.db.insert("profiles", {
        ...payload,
        createdAtMs: Date.now(),
      });
    },
  },
});
