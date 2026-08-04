import { getAuthUserId } from "@convex-dev/auth/server";
import type { GenericDatabaseReader } from "convex/server";
import type { DataModel, Id } from "../_generated/dataModel";
import { isEmailVerificationRequired } from "./emailVerificationPolicy";

type AuthCtx = Parameters<typeof getAuthUserId>[0] & {
  db: GenericDatabaseReader<DataModel>;
};

/** Require a signed-in Convex Auth user. Never trust client-supplied user IDs. */
export async function requireAuthUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return userId;
}

/**
 * Whether the auth user has completed email verification
 * (`users.emailVerificationTime` set by Convex Auth after OTP success).
 */
export async function isEmailVerified(
  ctx: AuthCtx,
  userId: Id<"users">,
): Promise<boolean> {
  const user = await ctx.db.get(userId);
  return user?.emailVerificationTime !== undefined;
}

/**
 * Auth (+ optional email verification) gate for private data reads/writes.
 * When REQUIRE_EMAIL_VERIFICATION is off, auth alone is enough (soft mode).
 * When on, also requires `emailVerificationTime` (Password provider `verify`
 * usually blocks sessions; this is defense-in-depth).
 */
export async function requireVerifiedAuthUserId(ctx: AuthCtx): Promise<Id<"users">> {
  const userId = await requireAuthUserId(ctx);
  if (isEmailVerificationRequired() && !(await isEmailVerified(ctx, userId))) {
    throw new Error("Email verification required");
  }
  return userId;
}

/**
 * Auth user when session is allowed to access private data; otherwise null.
 * Soft mode: any authenticated user. Hard mode: verified email only.
 */
export async function getVerifiedAuthUserId(
  ctx: AuthCtx,
): Promise<Id<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return null;
  }
  if (isEmailVerificationRequired() && !(await isEmailVerified(ctx, userId))) {
    return null;
  }
  return userId;
}
