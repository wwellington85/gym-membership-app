import {
  addDaysYmd,
  isAccessActiveAtJamaicaCutoff,
  jamaicaTodayYmd,
} from "@/lib/membership/status";

export type AccessScope = "none" | "gym" | "resort";
export type AccessPlan = {
  id: string;
  code: string;
  name: string;
  price: number;
  duration_days: number;
  grants_access: boolean;
  access_scope?: AccessScope | null;
  discount_food?: number;
  discount_spa?: number;
  discount_giftshop?: number;
  discount_watersports?: number;
  benefits?: Array<{ label: string; value: string }>;
};
export type AccessPass = {
  id: string;
  member_id: string;
  plan_id: string;
  start_date: string;
  paid_through_date: string;
  status: string;
  plan_snapshot: AccessPlan;
  payment_id?: string | null;
};

export function accessScope(plan?: Partial<AccessPlan> | null): AccessScope {
  if (!plan?.grants_access) return "none";
  if (plan.access_scope === "gym" || plan.code === "gym_day") return "gym";
  return plan.access_scope === "resort" ||
    ["club_day", "club_weekly", "club_monthly_95"].includes(plan.code || "")
    ? "resort"
    : "gym";
}

export function facilities(plan?: Partial<AccessPlan> | null): string[] {
  const scope = accessScope(plan);
  return scope === "resort"
    ? ["Gym", "Pool", "Beach chairs & towels", "Showers", "Lockers", "Lounge"]
    : scope === "gym"
      ? ["Gym"]
      : [];
}

export function passIsActive(pass: AccessPass, now = new Date()) {
  return (
    pass.status === "active" &&
    isAccessActiveAtJamaicaCutoff({
      status: pass.status,
      startDate: pass.start_date,
      paidThroughDate: pass.paid_through_date,
      durationDays: pass.plan_snapshot.duration_days,
      now,
    })
  );
}

export function purchasePeriod(args: {
  start: string;
  duration: number;
  renew?: boolean;
  current?: AccessPass | null;
  planId: string;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const today = jamaicaTodayYmd(now);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(args.start) ||
    Number.isNaN(Date.parse(args.start)) ||
    new Date(`${args.start}T12:00:00Z`).toISOString().slice(0, 10) !==
      args.start ||
    args.start < today
  )
    throw new Error("Choose today or a future start date.");
  if (
    !Number.isInteger(args.duration) ||
    args.duration < 1 ||
    args.duration >= 3650
  )
    throw new Error("This access product has an invalid duration.");
  let start = args.start;
  // Only an explicit renewal of this exact paid product may extend existing access.
  if (
    args.renew &&
    args.current?.plan_id === args.planId &&
    args.current.status === "active" &&
    args.current.paid_through_date >= today
  ) {
    const next = addDaysYmd(args.current.paid_through_date, 1);
    if (passIsActive(args.current, now) || args.current.start_date > today)
      start = next > start ? next : start;
  }
  return { start, end: addDaysYmd(start, args.duration - 1) };
}

export function pointsPerVisit(value: unknown) {
  const n = Number(value ?? 1);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 1;
}

export function memberNumber(id: string) {
  return `TC-${id.replace(/-/g, "").toUpperCase()}`;
}

export function memberIdFromNumber(raw: string) {
  const value = raw.replace(/^TC-/i, "").replace(/-/g, "");
  if (!/^[a-f0-9]{32}$/i.test(value)) return null;
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`.toLowerCase();
}

// Stored independently of UUIDs. Accept grouped input only when all 12 digits
// are present; 12-digit references remain accepted during the transition.
// Never coerce unsafe JavaScript numbers: the database returns 16 digits as text.
export function normalizeMemberNumber(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && !Number.isSafeInteger(value)) return null;
  const digits = String(value).trim().replace(/[\s-]/g, "");
  return /^[1-9](?:[0-9]{11}|[0-9]{15})$/.test(digits) ? digits : null;
}

export function formatMemberNumber(value: unknown): string | null {
  const digits = normalizeMemberNumber(value);
  return digits ? digits.match(/.{4}/g)!.join(" ") : null;
}
