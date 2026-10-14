/** The prices and limits used by both the UI and the authoritative backend. */
export const PRO_POLICY_VERSION = 1;
export const PRO_LOCK_KEY = "poscal_pro_paid_features_enabled";
export const PRICES = { monthly: 250_000, yearly: 2_500_000 } as const;
export type ProPlan = keyof typeof PRICES;
export const FREE_LIMITS = {
  journals: 1,
  entriesPerMonth: 15,
  screenshots: 5,
  storageBytes: 10 * 1024 * 1024,
};
export const PRO_LIMITS = {
  journals: 5,
  entriesPerMonth: null,
  screenshots: 500,
  storageBytes: 1024 * 1024 * 1024,
};
export const ORDER_OPEN_STATUSES = [
  "initializing",
  "pending",
  "review",
] as const;
export const utcMonth = (now: number) =>
  new Date(now).toISOString().slice(0, 7);

export function addPlanPeriod(start: number, plan: ProPlan): number {
  const date = new Date(start);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  if (plan === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.getTime();
}

export function safeReturnTo(value?: string): string {
  if (
    !value ||
    value.length > 1000 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some((char) => char.charCodeAt(0) < 32)
  )
    return "/journal";
  try {
    const url = new URL(value, "https://poscalfx.com");
    if (
      url.origin !== "https://poscalfx.com" ||
      ["/signin", "/signup", "/pro", "/pro/return"].includes(url.pathname)
    )
      return "/journal";
    for (const key of ["reference", "trxref", "access_code", "token"])
      url.searchParams.delete(key);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/journal";
  }
}

export function discountAmount(base: number, percent: number): number {
  if (!Number.isInteger(percent) || percent < 1 || percent > 90)
    throw new Error("Discount must be between 1% and 90%");
  return base - Math.floor((base * percent) / 100);
}

export type ProviderTransaction = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  domain?: string;
  id?: number | string;
  paid_at?: string;
  metadata?: { orderId?: string } | null;
  authorization?: {
    authorization_code?: string;
    signature?: string;
    reusable?: boolean;
    channel?: string;
    last4?: string;
    card_type?: string;
    brand?: string;
    bank?: string;
    exp_month?: string;
    exp_year?: string;
    country_code?: string;
  } | null;
};

export function verifyTransactionMatch(
  data: ProviderTransaction,
  order: { reference: string; amount: number; currency: string; _id: string },
  mode: "live" | "test",
): boolean {
  return (
    data.status === "success" &&
    data.reference === order.reference &&
    Number.isSafeInteger(data.amount) &&
    data.amount === order.amount &&
    data.currency === order.currency &&
    data.domain === mode &&
    data.metadata?.orderId === order._id &&
    ((typeof data.id === "string" && /^[0-9]+$/.test(data.id)) ||
      (typeof data.id === "number" &&
        Number.isSafeInteger(data.id) &&
        data.id > 0))
  );
}
