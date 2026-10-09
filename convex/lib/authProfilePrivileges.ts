/**
 * An authenticated user's own profile is the canonical source for role and
 * subscription entitlements. Convex Auth may initialise users.role to "user"
 * during sign-up/verification, even if an owned profile was already promoted.
 *
 * NEVER pass an email-matched profile belonging to a different user ID here.
 * When no ID-linked profile exists, fall back to the authenticated user only.
 */
export type AuthPrivilegeFields = {
  role?: string | null;
  paymentStatus?: string | null;
  subscriptionTier?: string | null;
  subscriptionExpiresAtMs?: number | null;
};

export function resolveOwnedProfilePrivileges(
  authUser: AuthPrivilegeFields,
  ownedProfile: AuthPrivilegeFields | null | undefined,
) {
  return {
    role: ownedProfile?.role ?? authUser.role ?? "user",
    paymentStatus: ownedProfile?.paymentStatus ?? authUser.paymentStatus ?? "free",
    subscriptionTier: ownedProfile?.subscriptionTier ?? authUser.subscriptionTier ?? "free",
    // An explicit null expiration on the owned profile must not resurrect a
    // stale expiration from the auth user after a subscription is cancelled.
    subscriptionExpiresAtMs:
      ownedProfile && ownedProfile.subscriptionExpiresAtMs !== undefined
        ? ownedProfile.subscriptionExpiresAtMs
        : authUser.subscriptionExpiresAtMs ?? null,
  };
}

/**
 * Only truly orphaned profiles can be rebound by email. Existing ID-linked
 * profiles always win; a different account's role is never inherited by email.
 * Entitlements from an orphan are NOT imported during adoption.
 */
export function canAdoptOrphanProfile(
  userId: string,
  hasOwnedProfile: boolean,
  emailProfile: { externalUserId?: string | null } | null | undefined,
): boolean {
  if (hasOwnedProfile || !emailProfile) return false;
  const boundTo = (emailProfile.externalUserId ?? "").trim();
  return !boundTo || boundTo === userId;
}
