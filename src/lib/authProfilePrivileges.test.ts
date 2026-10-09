import { describe, expect, it } from "vitest";
import {
  canAdoptOrphanProfile,
  resolveOwnedProfilePrivileges,
} from "../../convex/lib/authProfilePrivileges";

describe("Convex Auth profile privilege reconciliation", () => {
  it("preserves an ID-linked admin role when verification auth user has role user", () => {
    expect(resolveOwnedProfilePrivileges(
      { role: "user", paymentStatus: "free", subscriptionTier: "free" },
      { role: "admin" },
    ).role).toBe("admin");
  });

  it("preserves super admin on repeat authentication callbacks", () => {
    expect(resolveOwnedProfilePrivileges({ role: "user" }, { role: "super_admin" }).role)
      .toBe("super_admin");
  });

  it("respects a deliberate profile demotion when auth user has stale admin role", () => {
    expect(resolveOwnedProfilePrivileges({ role: "admin" }, { role: "user" }).role)
      .toBe("user");
  });

  it("preserves legitimate subscriptions when the auth user has default free values", () => {
    expect(resolveOwnedProfilePrivileges(
      {
        role: "user",
        paymentStatus: "free",
        subscriptionTier: "free",
        subscriptionExpiresAtMs: null,
      },
      {
        role: "admin",
        paymentStatus: "paid",
        subscriptionTier: "pro",
        subscriptionExpiresAtMs: 1791600000000,
      },
    )).toEqual({
      role: "admin",
      paymentStatus: "paid",
      subscriptionTier: "pro",
      subscriptionExpiresAtMs: 1791600000000,
    });
  });

  it("honors an explicitly cleared subscription expiry on the owned profile", () => {
    expect(resolveOwnedProfilePrivileges(
      { subscriptionExpiresAtMs: 1999999999000 },
      { subscriptionExpiresAtMs: null },
    ).subscriptionExpiresAtMs).toBeNull();
  });

  it("falls back to auth-user privileges when no linked profile exists", () => {
    expect(resolveOwnedProfilePrivileges({ role: "admin", subscriptionTier: "pro" }, null))
      .toEqual({
        role: "admin",
        paymentStatus: "free",
        subscriptionTier: "pro",
        subscriptionExpiresAtMs: null,
      });
  });

  it("defaults a brand-new account to user/free", () => {
    expect(resolveOwnedProfilePrivileges({}, null)).toEqual({
      role: "user",
      paymentStatus: "free",
      subscriptionTier: "free",
      subscriptionExpiresAtMs: null,
    });
  });

  it("never borrows admin from an email-matched profile owned by a different user ID", () => {
    expect(canAdoptOrphanProfile("new-convex-id", false, {
      externalUserId: "legacy-admin-id",
    })).toBe(false);
    expect(resolveOwnedProfilePrivileges({ role: "user" }, null).role).toBe("user");
  });

  it("does not replace a valid owned profile with a secondary email-matched orphan", () => {
    expect(canAdoptOrphanProfile("current-id", true, { externalUserId: "" })).toBe(false);
  });

  it("allows adoption of a truly orphaned email profile without inheriting its entitlements", () => {
    expect(canAdoptOrphanProfile("current-id", false, { externalUserId: "" })).toBe(true);
    // The callback deliberately resolves entitlements from the auth user,
    // not from the email profile being adopted.
    expect(resolveOwnedProfilePrivileges({ role: "user" }, null).role).toBe("user");
  });

  it("recognizes a same-user linked email profile if the owned-index lookup was absent", () => {
    expect(canAdoptOrphanProfile("current-id", false, { externalUserId: "current-id" }))
      .toBe(true);
  });

  it("rejects missing and unrelated email profiles", () => {
    expect(canAdoptOrphanProfile("current-id", false, null)).toBe(false);
    expect(canAdoptOrphanProfile("current-id", false, { externalUserId: "other-id" }))
      .toBe(false);
  });
});
