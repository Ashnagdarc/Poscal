/**
 * Soft email verification policy (Resend free-tier kill-switch).
 *
 * Convex env: REQUIRE_EMAIL_VERIFICATION
 *   unset / "0" / "false" / "no" → OFF (default): sessions + full app without OTP
 *   "1" / "true" / "yes"         → ON: Password `verify` + hard gates
 *
 * Flip for production after paid Resend:
 *   npx convex env set REQUIRE_EMAIL_VERIFICATION true
 * Redeploy/restart Convex so Password provider re-reads env (auth config is load-time).
 */

function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Default OFF so free-tier OTP delivery failures cannot lock users out. */
export function isEmailVerificationRequired(): boolean {
  return parseTruthyEnv(process.env.REQUIRE_EMAIL_VERIFICATION);
}
