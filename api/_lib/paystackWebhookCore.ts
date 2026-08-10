import crypto from "crypto";
import {
  computeSubscriptionExpiry,
  parseChargeSuccessReference,
  subscriptionTierForPlan,
  type PlanPeriod,
} from "./paymentReference.js";

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
  /** Billing period from reference (monthly/yearly). */
  planPeriod: PlanPeriod;
  /** Entitlement tier stored on the user/profile. */
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
  const a = Buffer.from(computed, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  return { ok: true };
}

export { computeSubscriptionExpiry, parseChargeSuccessReference };

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

  const { userId, planPeriod } = parsedRef;
  const reference = event.data?.reference as string;
  const tier = subscriptionTierForPlan(planPeriod);

  return {
    userId,
    planPeriod,
    tier,
    reference,
    amount: Number(event?.data?.amount || 0) / 100,
    currency: event?.data?.currency || "USD",
    expiresAtMs: computeSubscriptionExpiry(planPeriod, paidAtMs),
    paidAtMs,
    metadata: {
      source: "paystack-webhook",
      planId: planPeriod,
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
