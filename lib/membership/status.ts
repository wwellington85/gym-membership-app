export type MembershipTier =
  | "rewards_free"
  | "club_day"
  | "club_weekly"
  | "club_monthly_95";

export type MembershipStatus = "free" | "active" | "pending" | "expired";

export function computeMembershipStatus(args: {
  tier: MembershipTier | null;
  paid_through: string | null; // ISO date or timestamp
  db_status?: string | null;   // memberships.status (optional)
}): MembershipStatus {
  const tier = args.tier ?? "rewards_free";

  // Free rewards plan is always "free" (no facility access)
  if (tier === "rewards_free") return "free";

  const db = (args.db_status ?? "").toLowerCase();
  if (db === "pending") return "pending";
  if (db === "expired") return "expired";
  if (db === "active") {
    // still verify date if present, but treat active as active if paid_through parses
    const pt = args.paid_through ? new Date(args.paid_through) : null;
    if (!pt || Number.isNaN(pt.getTime())) return "pending";
    return pt.getTime() >= Date.now() ? "active" : "expired";
  }

  // Fallback: infer from paid_through_date
  const paidThrough = args.paid_through ? new Date(args.paid_through) : null;
  if (!paidThrough || Number.isNaN(paidThrough.getTime())) return "pending";
  return paidThrough.getTime() >= Date.now() ? "active" : "expired";
}
