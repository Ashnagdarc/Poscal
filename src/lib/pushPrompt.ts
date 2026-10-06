const HIDDEN_PREFIXES = [
  "/signin",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/welcome",
  "/terms",
  "/privacy",
];

export function shouldShowPushEnablePrompt(args: {
  pathname: string;
  isAuthenticated: boolean;
  authLoading: boolean;
  checked: boolean;
  isSupported: boolean;
  isConfigured: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;
  dismissedThisVisit: boolean;
  snoozed: boolean;
}): boolean {
  if (args.dismissedThisVisit || args.snoozed || args.authLoading || !args.isAuthenticated) return false;
  if (!args.checked || !args.isSupported || !args.isConfigured || args.isSubscribed) return false;
  // The modal is only for requesting permission. Granted devices are repaired
  // silently by the push provider, and denied devices must be changed in browser settings.
  if (args.permission !== "default") return false;
  return !HIDDEN_PREFIXES.some(
    (prefix) => args.pathname === prefix || args.pathname.startsWith(`${prefix}/`),
  );
}


const PUSH_PROMPT_SNOOZE_PREFIX = "poscal.pushPrompt.snoozedUntil.";
export const PUSH_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export function isPushPromptSnoozed(userId: string | null | undefined, now = Date.now()): boolean {
  if (!userId || typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(`${PUSH_PROMPT_SNOOZE_PREFIX}${userId}`);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= now) {
      localStorage.removeItem(`${PUSH_PROMPT_SNOOZE_PREFIX}${userId}`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function snoozePushPrompt(userId: string | null | undefined, now = Date.now()): void {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      `${PUSH_PROMPT_SNOOZE_PREFIX}${userId}`,
      String(now + PUSH_PROMPT_SNOOZE_MS),
    );
  } catch {
    // Storage can be unavailable in private mode. Session dismissal still applies.
  }
}

export function clearPushPromptSnooze(userId: string | null | undefined): void {
  if (!userId || typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(`${PUSH_PROMPT_SNOOZE_PREFIX}${userId}`);
  } catch {
    // Ignore storage access errors.
  }
}
