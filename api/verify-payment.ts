import { VercelRequest, VercelResponse } from "@vercel/node";
import { ConvexHttpClient } from "convex/browser";
import { api, convexServerClient } from "./_convex.js";
import {
  computeSubscriptionExpiry,
  expectedAmountMinorUnits,
  parseChargeSuccessReference,
  subscriptionTierForPlan,
} from "./lib/paymentReference.js";
import { syncSubscriptionFromPaymentHttp } from "./lib/paymentSyncClient.js";
import { verifyPaystackTransaction } from "./lib/paystackVerify.js";

const PAYMENT_SYNC_SECRET = process.env.PAYMENT_SYNC_SECRET;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const CONVEX_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;

export const config = {
  maxDuration: 30,
};

function getBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).send("ok");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (!PAYMENT_SYNC_SECRET || !PAYSTACK_SECRET_KEY || !CONVEX_URL) {
    return res.status(500).json({
      success: false,
      message: "Payment verification is not configured",
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: "Missing auth token" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const reference = typeof body.reference === "string" ? body.reference.trim() : "";
    if (!reference) {
      return res.status(400).json({ success: false, message: "Missing payment reference" });
    }

    // Resolve authenticated user from Convex JWT — never trust body.userId alone.
    const authedClient = new ConvexHttpClient(CONVEX_URL);
    authedClient.setAuth(token);
    const viewer = await authedClient.query(api.users.viewer, {});
    if (!viewer?.id) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const parsedRef = parseChargeSuccessReference(reference);
    if ("error" in parsedRef) {
      return res.status(400).json({ success: false, message: parsedRef.error });
    }

    if (parsedRef.userId !== viewer.id) {
      return res.status(403).json({
        success: false,
        message: "Payment reference does not belong to this account",
      });
    }

    const verified = await verifyPaystackTransaction(reference, PAYSTACK_SECRET_KEY);
    if (!verified.ok) {
      return res.status(verified.status).json({ success: false, message: verified.error });
    }

    const tx = verified.data;
    if (tx.status !== "success") {
      return res.status(400).json({ success: false, message: "Payment was not successful" });
    }
    if (tx.reference !== reference) {
      return res.status(400).json({ success: false, message: "Reference mismatch" });
    }

    const expectedMinor = expectedAmountMinorUnits(parsedRef.planPeriod);
    if (Number(tx.amount) !== expectedMinor) {
      return res.status(400).json({
        success: false,
        message: "Paid amount does not match selected plan",
      });
    }
    if (String(tx.currency || "").toUpperCase() !== "USD") {
      return res.status(400).json({ success: false, message: "Unexpected payment currency" });
    }

    const paidAtMs = tx.paid_at ? new Date(tx.paid_at).getTime() : Date.now();
    const paidAtSafe = Number.isFinite(paidAtMs) ? paidAtMs : Date.now();
    const tier = subscriptionTierForPlan(parsedRef.planPeriod);
    const expiresAtMs = computeSubscriptionExpiry(parsedRef.planPeriod, paidAtSafe);

    await syncSubscriptionFromPaymentHttp({
      userId: viewer.id,
      reference,
      tier,
      amount: expectedMinor / 100,
      currency: "USD",
      status: "success",
      expiresAtMs,
      paidAtMs: paidAtSafe,
      metadata: {
        source: "vercel-verify-payment",
        planId: parsedRef.planPeriod,
        paystack_customer_code: tx.customer?.customer_code ?? null,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified and subscription activated",
      data: {
        reference,
        tier,
        planId: parsedRef.planPeriod,
        expiresAt: new Date(expiresAtMs).toISOString(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
