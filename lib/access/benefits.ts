import { passIsActive, type AccessPass, type AccessPlan } from "./rules";

export const benefitOutlets = [
  { label: "Restaurant & bar", key: "discount_food" },
  { label: "Spa", key: "discount_spa" },
  { label: "Gift shop", key: "discount_giftshop" },
  { label: "Watersports", key: "discount_watersports" },
] as const;

// Keep Home, Benefits, and staff verification on the same eligibility rule:
// the highest current rate for each outlet; never add discounts together.
export function effectiveBenefits(
  free: AccessPlan | undefined,
  passes: AccessPass[],
  active = true,
  now = new Date(),
) {
  const plans = active
    ? ([
        free,
        ...passes
          .filter((pass) => passIsActive(pass, now))
          .map((pass) => pass.plan_snapshot),
      ].filter(Boolean) as AccessPlan[])
    : [];
  return benefitOutlets.map((outlet) => ({
    ...outlet,
    percent: Math.round(
      Math.max(
        0,
        ...plans.map((plan) => {
          const rate = Number(plan[outlet.key] ?? 0);
          return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0;
        }),
      ) * 100,
    ),
  }));
}
