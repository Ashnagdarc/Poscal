# Auth role preservation (Oct 9, 2026)

## Problem

Convex Auth's Password provider initializes a new auth record with role "user".
A later email-verification/auth callback could write that default into the
linked profile even if a trusted admin action had promoted that profile
to "admin" or "super_admin". The frontend also queried the same profile via
a second, token-dependent HTTP request, briefly reporting non-admin while
the session refreshed.

## Fix

1. An existing profile linked by the exact Convex auth-user ID is authoritative
   for role, paymentStatus, subscriptionTier and expiry.
2. Reconcile a stale auth-user mirror to that **same user's** profile. Legitimate
   demotions remain effective, since an admin role mutation updates both rows.
3. Do not adopt a secondary email-matched profile when an owned profile exists.
   When a truly orphaned email profile is adopted, do not copy its privileged
   fields. Never transfer roles based solely on name or email address.
4. The admin UI reads the role from the authenticated reactive users.viewer
   query already used by AuthProvider; no second token-dependent request.
5. The production Brevo parity gate pins the intentionally reviewed auth.ts
   version. The other ten live auth files remain byte-for-byte unchanged
   from the Oct 9 production Vercel source.

## Release boundary

This GitHub-only branch **does not deploy Convex, change user roles or run
a data migration**. Vercel's frontend build remains separate from the
explicit Convex backend deployment. Before promoting this fix, validate
the auth provider behaviour on the correct backend and exercise sign-in,
OTP/password-reset, admin authorization and an ordinary user account.

## Accounts whose admin access has already disappeared

Changing callback precedence cannot reconstruct a privilege value already
overwritten. A trusted operator must compare the production users record's
_id and role with the profiles row's externalUserId and role,
plus verification state and historical audit evidence.

- When they refer to the **same verified account**, restore the role only
  via an authorized admin operation after confirming previous entitlement.
- When they refer to **different account IDs**, investigate the account
  migration/identity link separately. Do not grant admin privileges to the
  new account merely because email or display name matches.
- Do not hardcode a privileged email/name, send database exports/secrets in
  chat, or allow end users to self-promote.
