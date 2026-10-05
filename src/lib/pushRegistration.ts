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
