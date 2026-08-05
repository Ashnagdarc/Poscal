/**
 * Client-side mirror of soft email verification policy.
 *
 * Default OFF so a missing/undeployed Convex query never locks the SPA.
 * For hard mode (paid Resend), set both:
 *   - Convex: REQUIRE_EMAIL_VERIFICATION=true (redeploy)
 *   - Vite:   VITE_REQUIRE_EMAIL_VERIFICATION=true
 */

function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Soft default: verification is optional until explicitly enabled. */
export function isClientEmailVerificationRequired(): boolean {
  return parseTruthyEnv(import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION);
}
