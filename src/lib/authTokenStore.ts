/**
 * In-memory mirror of the Convex Auth access token for non-React HTTP clients.
 * Intentionally does not persist the JWT (avoids a second XSS-readable copy).
 * Convex Auth may still store session material in localStorage by default.
 */

let memoryToken: string | null = null;

const LEGACY_MIRROR_KEY = "convex_auth_token";

export function setConvexAuthTokenMirror(token: string | null): void {
  memoryToken = token;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_MIRROR_KEY);
    window.sessionStorage.removeItem(LEGACY_MIRROR_KEY);
  } catch {
    // ignore quota / private-mode failures
  }
}

export function getConvexAuthTokenMirror(): string | null {
  return memoryToken;
}

export function clearLegacyAuthMirrors(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LEGACY_MIRROR_KEY);
    window.localStorage.removeItem("auth_token");
    window.localStorage.removeItem("user");
    window.sessionStorage.removeItem(LEGACY_MIRROR_KEY);
  } catch {
    // ignore
  }
}
