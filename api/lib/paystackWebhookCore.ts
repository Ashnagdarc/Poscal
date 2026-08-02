import crypto from "crypto";

export type PaystackChargeData = {
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  channel?: string;
  ip_address?: string;
  fees?: number;
  customer?: { customer_code?: string | null };
  authorization?: unknown;
  gateway_response?: unknown;
};

export type PaystackWebhookEvent = {
  event?: string;
  data?: PaystackChargeData;
};

export type ParsedChargeSuccess = {
  userId: string;
  tier: string;
  reference: string;
  amount: number;
  currency: string;
  expiresAtMs: number;
  paidAtMs: number;
  metadata: Record<string, unknown>;
};

export function verifyPaystackSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): { ok: true } | { ok: false; status: 401; error: string } {
  if (!signature) {
    return { ok: false, status: 401, error: "Missing signature" };
  }

  const computed = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  if (computed !== signature) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  return { ok: true };
}

export function computeSubscriptionExpiry(tier: string, paidAtMs: number): number {
  const expiryDate = new Date(paidAtMs);
  if (tier === "yearly" || tier === "pro") {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  } else if (tier === "lifetime") {
    // Legacy: lifetime is no longer sold; keep expiry handling for old charges.
    expiryDate.setFullYear(expiryDate.getFullYear() + 100);
  } else {
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  }
  return expiryDate.getTime();
}

export function parseChargeSuccessReference(
  reference: string | undefined,
): { userId: string; tier: string } | { error: string } {
  const refParts = (reference || "").split("_");
  const userId = refParts[1];
  const tier = refParts[2];

  if (!userId || !tier) {
    return { error: "Invalid reference format" };
  }

  return { userId, tier };
}

export function parseSuccessfulCharge(
  event: PaystackWebhookEvent,
  paidAtMs: number = Date.now(),
): ParsedChargeSuccess | null | { error: string; status: 400 } {
  if (event?.event !== "charge.success" || event?.data?.status !== "success") {
    return null;
  }

  const parsedRef = parseChargeSuccessReference(event.data?.reference);
  if ("error" in parsedRef) {
    return { error: parsedRef.error, status: 400 };
  }

  const { userId, tier } = parsedRef;
  const reference = event.data?.reference as string;

  return {
    userId,
    tier,
    reference,
    amount: Number(event?.data?.amount || 0) / 100,
    currency: event?.data?.currency || "USD",
    expiresAtMs: computeSubscriptionExpiry(tier, paidAtMs),
    paidAtMs,
    metadata: {
      source: "paystack-webhook",
      channel: event?.data?.channel,
      ip_address: event?.data?.ip_address,
      fees: event?.data?.fees || 0,
      customer_code: event?.data?.customer?.customer_code || null,
      authorization: event?.data?.authorization,
      gateway_response: event?.data?.gateway_response,
      webhook_event: event?.event,
    },
  };
}
