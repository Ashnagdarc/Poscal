import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  computeSubscriptionExpiry,
  parseChargeSuccessReference,
  parseSuccessfulCharge,
  verifyPaystackSignature,
} from "./paystackWebhookCore";

const SECRET = "test_webhook_secret";

function sign(body: string, secret = SECRET) {
  return crypto.createHmac("sha512", secret).update(Buffer.from(body)).digest("hex");
}

describe("verifyPaystackSignature", () => {
  it("rejects missing signature", () => {
    const result = verifyPaystackSignature(Buffer.from("{}"), undefined, SECRET);
    expect(result).toEqual({ ok: false, status: 401, error: "Missing signature" });
  });

  it("rejects invalid signature", () => {
    const body = Buffer.from('{"event":"charge.success"}');
    const result = verifyPaystackSignature(body, "deadbeef", SECRET);
    expect(result).toEqual({ ok: false, status: 401, error: "Invalid signature" });
  });

  it("accepts a valid HMAC signature", () => {
    const payload = '{"event":"charge.success"}';
    const result = verifyPaystackSignature(Buffer.from(payload), sign(payload), SECRET);
    expect(result).toEqual({ ok: true });
  });
});

describe("parseChargeSuccessReference", () => {
  it("parses userId and tier from reference", () => {
    expect(parseChargeSuccessReference("psk_user123_monthly")).toEqual({
      userId: "user123",
      tier: "monthly",
    });
  });

  it("rejects malformed references", () => {
    expect(parseChargeSuccessReference("psk_onlyuser")).toEqual({
      error: "Invalid reference format",
    });
    expect(parseChargeSuccessReference(undefined)).toEqual({
      error: "Invalid reference format",
    });
  });
});

describe("computeSubscriptionExpiry", () => {
  const paidAt = Date.UTC(2026, 0, 15);

  it("adds one month for monthly tiers", () => {
    const expiry = computeSubscriptionExpiry("monthly", paidAt);
    expect(new Date(expiry).getUTCMonth()).toBe(1);
  });

  it("adds one year for yearly/pro", () => {
    expect(new Date(computeSubscriptionExpiry("yearly", paidAt)).getUTCFullYear()).toBe(2027);
    expect(new Date(computeSubscriptionExpiry("pro", paidAt)).getUTCFullYear()).toBe(2027);
  });

  it("adds ~100 years for lifetime", () => {
    expect(new Date(computeSubscriptionExpiry("lifetime", paidAt)).getUTCFullYear()).toBe(2126);
  });
});

describe("parseSuccessfulCharge", () => {
  const paidAt = Date.UTC(2026, 0, 15);

  it("returns null for non-success events", () => {
    expect(parseSuccessfulCharge({ event: "charge.failed" }, paidAt)).toBeNull();
    expect(
      parseSuccessfulCharge(
        { event: "charge.success", data: { status: "failed", reference: "psk_u_monthly" } },
        paidAt,
      ),
    ).toBeNull();
  });

  it("returns 400 for invalid reference on success", () => {
    expect(
      parseSuccessfulCharge(
        { event: "charge.success", data: { status: "success", reference: "bad" } },
        paidAt,
      ),
    ).toEqual({ error: "Invalid reference format", status: 400 });
  });

  it("parses a valid charge.success payload", () => {
    const result = parseSuccessfulCharge(
      {
        event: "charge.success",
        data: {
          status: "success",
          reference: "psk_user99_yearly",
          amount: 500000,
          currency: "NGN",
          channel: "card",
          fees: 100,
        },
      },
      paidAt,
    );

    expect(result).toMatchObject({
      userId: "user99",
      tier: "yearly",
      reference: "psk_user99_yearly",
      amount: 5000,
      currency: "NGN",
      paidAtMs: paidAt,
    });
    expect(result && "expiresAtMs" in result && result.expiresAtMs).toBeGreaterThan(paidAt);
  });
});
