/** Paystack amounts are in the smallest currency unit (cents for USD). */
export const PAYMENT_CURRENCY = "USD" as const;

const MONTHLY_USD = 5;
const YEARLY_USD = Number((MONTHLY_USD * 12 * 0.98).toFixed(2)); // 2% off annual

const toMinorUnits = (usd: number) => Math.round(usd * 100);

export const PLAN_OPTIONS = [
  {
    id: "monthly",
    name: "Monthly",
    amount: toMinorUnits(MONTHLY_USD),
    displayPrice: `$${MONTHLY_USD}`,
    periodLabel: "/mo",
    summary: "Cancel anytime",
  },
  {
    id: "yearly",
    name: "Yearly",
    amount: toMinorUnits(YEARLY_USD),
    displayPrice: `$${YEARLY_USD.toFixed(2)}`,
    periodLabel: "/yr",
    summary: "Billed once a year",
    badge: "Save 2%",
  },
] as const;

export type PlanId = (typeof PLAN_OPTIONS)[number]["id"];

export const MONTHLY_PLAN = PLAN_OPTIONS[0];
export const YEARLY_PLAN = PLAN_OPTIONS[1];
