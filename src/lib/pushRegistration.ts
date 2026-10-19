export type PushSubscriptionRecord = { endpoint: string };

export function isBrowserSubscriptionRegistered(
  endpoint: string | null | undefined,
  subscriptions: PushSubscriptionRecord[] | undefined,
): boolean {
  if (!endpoint || !subscriptions) return false;
  return subscriptions.some((subscription) => subscription.endpoint === endpoint);
}

export function shouldRotatePushSubscription(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /endpoint is already registered|credentials do not match/i.test(message);
}

export function pushSetupErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");

  if (/not authenticated|authentication|unauthorized/i.test(message)) {
    return "Your Poscal session is not ready. Sign in again, then retry.";
  }
  if (/credentials do not match/i.test(message)) {
    return "This browser has a stale push subscription. Disable notifications in your browser, refresh Poscal, then enable them again.";
  }
  if (/service worker|did not become active|failed to install/i.test(message)) {
    return "Notifications could not start because the app service worker did not activate. Refresh Poscal and try again.";
  }
  if (/permission request timeout/i.test(message)) {
    return "The browser did not confirm notification permission. Try again.";
  }
  if (/server request timeout/i.test(message)) {
    return "Push setup timed out while contacting Poscal. Please try again.";
  }
  if (/network|fetch|connection|offline/i.test(message)) {
    return "Poscal could not reach the notification service. Check your connection and try again.";
  }

  return "Poscal could not save this device for push notifications. Please try again.";
}
