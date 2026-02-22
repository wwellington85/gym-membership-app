export type MembershipTier =
  | "rewards_free"
  | "club_day"
  | "club_weekly"
  | "club_monthly_95";

export type MembershipStatus = "free" | "active" | "pending" | "expired";

const JAMAICA_TZ = "America/Jamaica";
const ACCESS_CUTOFF_HOUR_JM = 22; // 10:00 PM local cutoff

function toJamaicaParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAMAICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const out: Record<string, string> = {};
  parts.forEach((p) => {
    if (p.type !== "literal") out[p.type] = p.value;
  });

  return {
    ymd: `${out.year}-${out.month}-${out.day}`,
    hour: Number.parseInt(out.hour ?? "0", 10),
  };
}

export function jamaicaNowParts(now = new Date()) {
  return toJamaicaParts(now);
}

export function jamaicaTodayYmd(now = new Date()) {
  return toJamaicaParts(now).ymd;
}

export function normalizeToYmd(raw?: string | null): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;

  const direct = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direct?.[1]) return direct[1];

  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: JAMAICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

export function addDaysYmd(startYmd: string, daysToAdd: number): string {
  const [y, m, d] = startYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + daysToAdd);
  return dt.toISOString().slice(0, 10);
}

export function effectivePaidThroughYmd(args: {
  startDate?: string | null;
  paidThroughDate?: string | null;
  durationDays?: number | null;
}): string | null {
  const startYmd = normalizeToYmd(args.startDate);
  const paidYmd = normalizeToYmd(args.paidThroughDate);
  const durationDays = Number(args.durationDays ?? 0);

  // Prefer DB paid-through when present. It's authoritative after renewals/extensions.
  if (paidYmd) return paidYmd;

  if (startYmd && Number.isFinite(durationDays) && durationDays > 0 && durationDays < 3650) {
    // Duration is inclusive of start date: 1-day pass ends same day.
    return addDaysYmd(startYmd, Math.max(durationDays - 1, 0));
  }

  return null;
}

export function isAccessActiveAtJamaicaCutoff(args: {
  status?: string | null;
  startDate?: string | null;
  paidThroughDate?: string | null;
  durationDays?: number | null;
  now?: Date;
}): boolean {
  const status = String(args.status ?? "").toLowerCase();
  if (status === "pending" || status === "expired") return false;

  const nowParts = toJamaicaParts(args.now);
  const startYmd = normalizeToYmd(args.startDate);
  if (startYmd && nowParts.ymd < startYmd) return false;

  const durationDays = Number(args.durationDays ?? 0);
  const noExpiry = Number.isFinite(durationDays) && durationDays >= 3650;
  if (noExpiry) return true;

  const paidThroughYmd = effectivePaidThroughYmd({
    startDate: args.startDate,
    paidThroughDate: args.paidThroughDate,
    durationDays: args.durationDays,
  });

  if (!paidThroughYmd) return status === "active" || status === "due_soon";
  if (nowParts.ymd < paidThroughYmd) return true;
  if (nowParts.ymd > paidThroughYmd) return false;
  return nowParts.hour < ACCESS_CUTOFF_HOUR_JM;
}

export function computeMembershipStatus(args: {
  tier: MembershipTier | null;
  paid_through: string | null; // ISO date or timestamp
  start_date?: string | null;
  duration_days?: number | null;
  db_status?: string | null;   // memberships.status (optional)
}): MembershipStatus {
  const tier = args.tier ?? "rewards_free";

  // Free rewards plan is always "free" (no facility access)
  if (tier === "rewards_free") return "free";

  const db = (args.db_status ?? "").toLowerCase();
  if (db === "pending") return "pending";
  if (db === "expired") return "expired";

  const active = isAccessActiveAtJamaicaCutoff({
    status: db,
    startDate: args.start_date ?? null,
    paidThroughDate: args.paid_through ?? null,
    durationDays: args.duration_days ?? null,
  });

  return active ? "active" : "expired";
}
