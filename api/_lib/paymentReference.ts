/** Checkout plan periods encoded in Paystack references. */
export type PlanPeriod = "monthly" | "yearly";

/** Product entitlement tier stored on profiles/users. */
export type SubscriptionTier = "free" | "premium" | "pro";

/** Keep in sync with `src/lib/pricing.ts` (amounts in minor units). */
const PLAN_AMOUNTS_MINOR: Record<PlanPeriod, number> = {
  monthly: 500, // $5.00
  yearly: 5880, // $58.80 (2% off annual)
};

const PLAN_IDS = new Set<string>(["monthly", "yearly"]);

export function isPlanPeriod(value: string): value is PlanPeriod {
  return PLAN_IDS.has(value);
}

/**
 * Paystack reference: `psk_{userId}_{planPeriod}_{timestamp}`
 * Convex user ids are underscore-free; parse plan + timestamp from the end.
 */
export function buildPaymentReference(
  userId: string,
  planPeriod: PlanPeriod,
  nowMs = Date.now(),
): string {
  const safeUserId = userId.trim();
  if (!safeUserId || safeUserId.includes("_")) {
    throw new Error("Invalid user id for payment reference");
  }
  return `psk_${safeUserId}_${planPeriod}_${nowMs}`;
}

export function parseChargeSuccessReference(
  reference: string | undefined,
): { userId: string; planPeriod: PlanPeriod } | { error: string } {
  const parts = (reference || "").split("_");
  if (parts.length < 3 || parts[0] !== "psk") {
    return { error: "Invalid reference format" };
  }

  const maybeTimestamp = parts[parts.length - 1];
  const hasTimestamp = /^\d{10,}$/.test(maybeTimestamp);
  const planPart = hasTimestamp ? parts[parts.length - 2] : parts[parts.length - 1];
  const userId = hasTimestamp
    ? parts.slice(1, -2).join("_")
    : parts.slice(1, -1).join("_");

  if (userId && isPlanPeriod(planPart)) {
    return { userId, planPeriod: planPart };
  }

  // Legacy: psk_{userId}_{monthly|yearly}
  if (!hasTimestamp && parts.length >= 3) {
    const legacyUser = parts[1];
    const legacyPlan = parts[2];
    if (legacyUser && isPlanPeriod(legacyPlan)) {
      return { userId: legacyUser, planPeriod: legacyPlan };
    }
  }

  return { error: "Invalid reference format" };
}

export function subscriptionTierForPlan(_planPeriod: PlanPeriod): SubscriptionTier {
  return "premium";
}

/** Map stored/legacy tier strings for entitlement checks. */
export function normalizeSubscriptionTier(value: string | undefined | null): SubscriptionTier {
  if (value === "pro") return "pro";
  if (value === "premium" || value === "monthly" || value === "yearly") return "premium";
  return "free";
}

export function computeSubscriptionExpiry(planPeriod: string, paidAtMs: number): number {
  const expiryDate = new Date(paidAtMs);
  if (planPeriod === "yearly" || planPeriod === "pro") {
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  } else if (planPeriod === "lifetime") {
    expiryDate.setFullYear(expiryDate.getFullYear() + 100);
  } else {
    expiryDate.setMonth(expiryDate.getMonth() + 1);
  }
  return expiryDate.getTime();
}

export function expectedAmountMinorUnits(planPeriod: PlanPeriod): number {
  return PLAN_AMOUNTS_MINOR[planPeriod];
}
