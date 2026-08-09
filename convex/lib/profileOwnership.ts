import type { Doc, Id } from "../_generated/dataModel";

type Db = {
  query: (table: "profiles") => {
    withIndex: (
      name: "by_external_user_id" | "by_email",
      fn: (q: any) => any,
    ) => { first: () => Promise<Doc<"profiles"> | null> };
  };
};

/**
 * Resolve the caller's profile without claiming another account's row by email.
 * Email fallback is allowed only for orphan rows (empty externalUserId) or rows
 * already bound to this user.
 */
export async function findOwnedOrOrphanProfile(
  db: Db,
  userId: Id<"users"> | string,
  email?: string | null,
): Promise<Doc<"profiles"> | null> {
  const byUserId = await db
    .query("profiles")
    .withIndex("by_external_user_id", (q) => q.eq("externalUserId", userId))
    .first();

  if (byUserId) {
    return byUserId;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const byEmail = await db
    .query("profiles")
    .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
    .first();

  if (!byEmail) {
    return null;
  }

  const boundTo = (byEmail.externalUserId ?? "").trim();
  if (!boundTo || boundTo === userId) {
    return byEmail;
  }

  // Bound to a different auth user — do not rebind or inherit privileges.
  return null;
}

/** True when a legacy email profile may be linked to this auth user. */
export function canLinkLegacyProfile(
  profile: Doc<"profiles">,
  userId: Id<"users"> | string,
): boolean {
  const boundTo = (profile.externalUserId ?? "").trim();
  return !boundTo || boundTo === userId;
}
