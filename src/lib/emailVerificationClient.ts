/**
 * Load-time fallback for email verification UI while Convex policy loads.
 *
 * Runtime SoT: `api.authSettings.getVerificationPolicy` (Convex env
 * `REQUIRE_EMAIL_VERIFICATION`). Prefer that in ProtectedRoute / VerifyEmail.
 *
 * Optional Vite mirror `VITE_REQUIRE_EMAIL_VERIFICATION` only covers the brief
 * window before the query resolves — keep it aligned with Convex in deploy.
 */

function parseTruthyEnv(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  const v = raw.trim().toLowerCase();
  if (v === "" || v === "0" || v === "false" || v === "no" || v === "off") {
    return false;
  }
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/** Soft default: verification is optional until Convex (or Vite fallback) enables it. */
export function isClientEmailVerificationRequired(): boolean {
  return parseTruthyEnv(import.meta.env.VITE_REQUIRE_EMAIL_VERIFICATION);
}
