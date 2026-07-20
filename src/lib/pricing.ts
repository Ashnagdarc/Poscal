export const PLAN_OPTIONS = [
  {
    id: "monthly",
    name: "Monthly",
    amount: 300000,
    displayPrice: "₦3,000",
    periodLabel: "/mo",
    summary: "Cancel anytime",
  },
  {
    id: "yearly",
    name: "Yearly",
    amount: 3000000,
    displayPrice: "₦30,000",
    periodLabel: "/yr",
    summary: "Best value for active traders",
    badge: "Save 17%",
  },
  {
    id: "lifetime",
    name: "Lifetime",
    amount: 10000000,
    displayPrice: "₦100,000",
    periodLabel: "once",
    summary: "One payment, lifetime access",
  },
] as const;

export type PlanId = (typeof PLAN_OPTIONS)[number]["id"];

export const MONTHLY_PLAN = PLAN_OPTIONS[0];
