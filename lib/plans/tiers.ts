// Shared tier display metadata used across member pages.
// Source of truth for *display copy* (access bullets, badges, price labels).
// Discounts are sourced from membership_plans in DB where available.

type PlanCode = "rewards_free" | "club_day" | "club_weekly" | "club_monthly_95";

type Tier = {
  code: PlanCode;
  name: string;
  priceLabel: string;
  badge?: string;
  discounts: Array<{ label: string; value: string }>;
  access: string[];
notes?: string[];
};

const TIERS: Tier[] = [
  {
    code: "rewards_free",
    name: "Travellers Rewards",
    priceLabel: "Free",
    badge: "Discounts only",
    discounts: [
      { label: "Restaurant & Bar", value: "5% off" },
      { label: "Spa services", value: "5% off" },
      { label: "Gift shop", value: "5% off" },
      { label: "Watersports", value: "5% off" },
      { label: "Complimentary high-speed Wi‑Fi", value: "Included" },
    ],

    access: [],
    notes: ["No facility access (gym, pool, towels, lockers, showers)."],
  },
  {
    code: "club_day",
    name: "Travellers Club Day Pass",
    priceLabel: "$25 / day",
    badge: "Full access",
    discounts: [
      { label: "Restaurant & Bar", value: "10% off" },
      { label: "Spa services", value: "10% off" },
      { label: "Gift shop", value: "10% off" },
      { label: "Watersports", value: "10% off" },
      { label: "Complimentary high-speed Wi‑Fi", value: "Included" },
    ],

    access: [
      "Gym access",
      "Pool access",
      "Beach chairs & towels",
      "Showers",
      "Lockers",
      "Lounge access",
    ],
  },
  {
    code: "club_weekly",
    name: "Travellers Club Weekly Pass",
    priceLabel: "$45 / week",
    badge: "Full access",
    discounts: [
      { label: "Restaurant & Bar", value: "15% off" },
      { label: "Spa services", value: "10% off" },
      { label: "Gift shop", value: "10% off" },
      { label: "Watersports", value: "10% off" },
      { label: "Complimentary high-speed Wi‑Fi", value: "Included" },
    ],

    access: [
      "Gym access",
      "Pool access",
      "Beach chairs & towels",
      "Showers",
      "Lockers",
      "Lounge access",
    ],
  },
  {
    code: "club_monthly_95",
    name: "Travellers Club Monthly",
    priceLabel: "$95 / month",
    badge: "Best value",
    discounts: [
      { label: "Restaurant & Bar", value: "20% off" },
      { label: "Spa services", value: "15% off" },
      { label: "Gift shop", value: "15% off" },
      { label: "Watersports", value: "15% off" },
      { label: "Complimentary high-speed Wi‑Fi", value: "Included" },
    ],

    access: [
      "Gym access",
      "Pool access",
      "Beach chairs & towels",
      "Showers",
      "Lockers",
      "Lounge access",
    ],
    notes: ["Great for locals or longer stays."],
  },
];
function byCode(code?: string | null): Tier {
  const c = String(code || "rewards_free") as PlanCode;
  return TIERS.find((t) => t.code === c) ?? TIERS[0];
}

export { TIERS, byCode };
export type { Tier, PlanCode };
