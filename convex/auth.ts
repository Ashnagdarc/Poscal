import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

import { internal } from "./_generated/api";
import { BrevoOTP } from "./BrevoOTP";
import { BrevoOTPPasswordReset } from "./BrevoOTPPasswordReset";
import { isEmailVerificationRequired } from "./lib/emailVerificationPolicy";
import { canAdoptOrphanProfile, resolveOwnedProfilePrivileges } from "./lib/authProfilePrivileges";

const MIN_PASSWORD_LENGTH = 10;

/*
 * Email verification rollout switch:
 * - Default OFF via REQUIRE_EMAIL_VERIFICATION unset/false → no Password `verify`
 *   provider; sign-up/sign-in issue sessions without OTP (OTP code paths stay in repo).
 * - Set REQUIRE_EMAIL_VERIFICATION=true (or "1") in Convex env + redeploy to re-enable
 *   hard verification (MC-010) after Brevo is configured and tested.
 *   npx convex env set REQUIRE_EMAIL_VERIFICATION true
 */
const requireEmailVerification = isEmailVerificationRequired();

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: BrevoOTPPasswordReset,
      // Only attach when hard gate is ON. Convex Auth Password treats any `verify`
      // provider as mandatory for sign-up / unverified sign-in (blocks session until OTP).
      ...(requireEmailVerification ? { verify: BrevoOTP } : {}),
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

      // Credentials sign-up only. Sign-in and a later verification pass set existingUserId.
      if (
        !requireEmailVerification
        && args.existingUserId === null
        && args.type === "credentials"
      ) {
        const rawName = (user.fullName ?? user.name ?? "").trim();
        await ctx.scheduler.runAfter(0, internal.welcomeEmail.sendWelcome, {
          email,
          name: rawName,
        });
      }

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

      // Never overwrite an ID-linked profile with a secondary email match.
      // Rebinding an actual orphan does not import its admin/paid privileges.
      const orphanLegacy = canAdoptOrphanProfile(args.userId, Boolean(byUserId), byEmail)
        ? byEmail
        : null;

      const avatarSource = orphanLegacy ?? byUserId;
      const avatarUrl =
        user.avatarUrl ??
        user.image ??
        avatarSource?.avatarUrl ??
        null;

      // An existing ID-linked profile is authoritative. Convex Auth can carry
      // a stale "user"/"free" default after verification; never overwrite an
      // owned admin/paid profile with those defaults.
      const privileges = resolveOwnedProfilePrivileges(user, byUserId);
      const payload = {
        externalUserId: args.userId,
        email,
        fullName: user.fullName ?? user.name ?? avatarSource?.fullName ?? null,
        avatarUrl,
        ...privileges,
        updatedAtMs: Date.now(),
      };

      // Keep auth user avatar in sync so viewer() also returns it.
      if (avatarUrl && (user.avatarUrl !== avatarUrl || user.image !== avatarUrl)) {
        await ctx.db.patch(args.userId, {
          avatarUrl,
          image: avatarUrl,
        });
      }

      if (orphanLegacy) {
        await db.patch(orphanLegacy._id, {
          ...payload,
          // Source is the authenticated user, NOT the legacy email match.
        });
        return;
      }

      if (byUserId) {
        // Keep the auth-user mirror aligned with the canonical owned profile.
        // Admin mutations write both records; auth verification must not
        // silently demote an administrator or reset paid entitlements.
        const userPrivilegePatch = {
          ...(user.role !== privileges.role ? { role: privileges.role } : {}),
          ...(user.paymentStatus !== privileges.paymentStatus
            ? { paymentStatus: privileges.paymentStatus } : {}),
          ...(user.subscriptionTier !== privileges.subscriptionTier
            ? { subscriptionTier: privileges.subscriptionTier } : {}),
          ...(user.subscriptionExpiresAtMs !== privileges.subscriptionExpiresAtMs
            ? { subscriptionExpiresAtMs: privileges.subscriptionExpiresAtMs } : {}),
        };
        if (Object.keys(userPrivilegePatch).length > 0) {
          await ctx.db.patch(args.userId, userPrivilegePatch);
        }
        await db.patch(byUserId._id, {
          ...payload,
          avatarUrl: avatarUrl ?? byUserId.avatarUrl ?? null,
        });
        return;
      }

      await db.insert("profiles", {
        ...payload,
        createdAtMs: Date.now(),
      });
    },
  },
});
