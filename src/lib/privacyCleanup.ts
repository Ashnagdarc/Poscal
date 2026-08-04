/**
 * Clear device-local residues that survive Convex session sign-out / account delete
 * (AP-009 / MC-020). Preference keys (theme, font, risk default) are left alone.
 */

const SENSITIVE_KEY_PREFIXES = [
  "positionSizeHistory",
  "progressSession",
  "progressNotes",
  "journalProgress",
  "pushSubscription",
] as const;

const SENSITIVE_EXACT_KEYS = [
  "positionSizeHistory",
  "pushSubscription",
] as const;

export function clearSensitiveLocalStorage(): void {
  if (typeof localStorage === "undefined") return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (SENSITIVE_EXACT_KEYS.includes(key as (typeof SENSITIVE_EXACT_KEYS)[number])) {
        keysToRemove.push(key);
        continue;
      }
      if (SENSITIVE_KEY_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}:`) || key.startsWith(`${prefix}_`))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage access errors (private mode, quota, etc.).
  }
}
