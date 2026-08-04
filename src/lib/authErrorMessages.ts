/**
 * Map Convex Auth / Resend internals to stable user-facing messages (AIS-008 / ETH-001).
 * Keep free of React so vitest can cover without Convex runtime.
 */

export function toSafeAuthErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toLowerCase();

  // Convex Auth / Password provider variants for wrong credentials
  if (
    normalized.includes("invalidsecret")
    || normalized.includes("invalid secret")
    || normalized.includes("invalid credentials")
    || normalized.includes("invalid account id")
    || normalized.includes("invalid password")
    || normalized.includes("could not find")
    || normalized.includes("incorrect")
    || normalized.includes("no account")
    || normalized.includes("account not found")
    || normalized.includes("user not found")
    || normalized.includes("autherror")
    || normalized.includes("failed to authenticate")
  ) {
    return "Invalid email or password";
  }

  if (normalized.includes("already exists") || normalized.includes("already in use")) {
    return "An account with this email already exists";
  }

  if (
    normalized.includes("email not confirmed")
    || normalized.includes("not verified")
    || normalized.includes("email verification required")
  ) {
    return "Please verify your email to continue";
  }

  if (
    normalized.includes("too many")
    || normalized.includes("rate")
    || normalized.includes("attempts")
    || normalized.includes("quota")
  ) {
    return "Too many attempts. Please wait and try again.";
  }

  if (
    normalized.includes("could not send")
    || normalized.includes("not configured")
    || normalized.includes("verification email is not configured")
    || normalized.includes("password reset email is not configured")
    || normalized.includes("email verification is not enabled")
  ) {
    return "Email could not be sent. Please try again later, or ask an admin if mail is configured.";
  }

  if (
    normalized.includes("password must be")
    || normalized.includes("invalid password.")
    || (normalized.includes("at least") && normalized.includes("character"))
  ) {
    return "Password must be at least 10 characters and include a letter and a number.";
  }

  if (normalized.includes("invalid code") || normalized.includes("could not verify")) {
    return "Invalid or expired code. Request a new one.";
  }

  // Never surface stacks, file paths, or Convex request IDs to the UI.
  if (
    raw.includes("\n")
    || raw.includes(" at ")
    || raw.includes("Request ID")
    || raw.includes("@convex")
    || raw.includes(".ts:")
    || raw.includes(".js:")
    || raw.length > 160
  ) {
    return fallback;
  }

  return raw.trim() || fallback;
}

/** True when the failure is likely "no account" rather than mail/config misconfig. */
export function isMissingAccountAuthError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toLowerCase();
  return (
    normalized.includes("account not found")
    || normalized.includes("no account")
    || normalized.includes("user not found")
    || normalized.includes("could not find")
    || normalized.includes("invalid account id")
  );
}

/**
 * Password-reset request: surface real mail/config failures; soft-succeed (null error)
 * when the address has no account so we avoid enumeration and avoid blocking UX on Resend.
 */
export function mapPasswordResetRequestError(error: unknown): string | null {
  if (isMissingAccountAuthError(error)) {
    return null;
  }
  const mapped = toSafeAuthErrorMessage(error, "Could not start password reset");
  // Credential-style mapping is not useful on reset; treat as soft-success if it collapsed there.
  if (mapped === "Invalid email or password") {
    return null;
  }
  return mapped;
}
