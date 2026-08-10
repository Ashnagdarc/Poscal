/**
 * Call Convex payment httpActions with PAYMENT_SYNC_SECRET in the Authorization
 * header — never pass the secret as a Convex mutation argument.
 */

function resolveConvexSiteUrl(): string {
  const explicit = process.env.CONVEX_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const cloudUrl = (process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || "").trim();
  if (!cloudUrl) {
    throw new Error("CONVEX_SITE_URL or CONVEX_URL is not configured");
  }

  // https://xxx.convex.cloud → https://xxx.convex.site
  return cloudUrl.replace(/\.convex\.cloud\/?$/, ".convex.site").replace(/\/$/, "");
}

async function postPaymentSync<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const secret = process.env.PAYMENT_SYNC_SECRET;
  if (!secret) {
    throw new Error("PAYMENT_SYNC_SECRET is not configured");
  }

  const url = `${resolveConvexSiteUrl()}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Payment sync ${path} returned non-JSON (${response.status})`);
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Payment sync ${path} failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export async function syncSubscriptionFromPaymentHttp(args: {
  userId: string;
  reference: string;
  tier: string;
  amount: number;
  currency: string;
  status: string;
  expiresAtMs?: number | null;
  paidAtMs: number;
  metadata?: unknown;
}) {
  return postPaymentSync<{ ok: boolean; success?: boolean }>("/payments/sync", {
    ...args,
  });
}

export async function expireSubscriptionsBeforeHttp(beforeMs: number) {
  return postPaymentSync<{ ok: boolean; success?: boolean; expiredCount?: number }>(
    "/payments/expire",
    { beforeMs },
  );
}

export async function listExpiringSubscriptionsHttp(fromMs: number, toMs: number) {
  const result = await postPaymentSync<{
    ok: boolean;
    profiles: Array<{
      userId: string;
      email?: string | null;
      fullName?: string | null;
      subscriptionExpiresAtMs?: number | null;
    }>;
  }>("/payments/expiring", { fromMs, toMs });
  return result.profiles ?? [];
}
