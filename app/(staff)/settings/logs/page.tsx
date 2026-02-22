export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionType = "all" | "payment" | "checkin";
type RangeKey = "7" | "30" | "60" | "90" | "all";

type PaymentRow = {
  id: string;
  amount: number | null;
  created_at: string | null;
  paid_on: string | null;
  payment_method: string | null;
  member_id: string | null;
  membership_id: string | null;
  staff_user_id: string | null;
  notes: string | null;
};

type CheckinRow = {
  id: string;
  checked_in_at: string | null;
  member_id: string | null;
  staff_user_id: string | null;
  points_earned: number | null;
};

type MemberRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type StaffRow = {
  user_id: string;
  username?: string | null;
  email?: string | null;
  role?: string | null;
};

type EventItem = {
  id: string;
  type: "payment" | "checkin";
  happenedAt: string;
  memberId: string | null;
  staffUserId: string | null;
  primary: string;
  secondary: string;
};

function isDateOnly(v?: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
}

function parseTs(v?: string | null) {
  if (!v) return null;
  if (isDateOnly(v)) {
    const d = new Date(`${v}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtJamaicaDateTime(v?: string | null) {
  const d = parseTs(v);
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function roleLabel(role?: string | null) {
  if (role === "admin") return "Admin";
  if (role === "front_desk") return "Front Desk";
  if (role === "security") return "Security";
  return "Staff";
}

function rangeStartIso(range: RangeKey) {
  if (range === "all") return null;
  const days = Number.parseInt(range, 10);
  const safeDays = Number.isFinite(days) ? Math.max(1, days) : 30;
  const start = new Date();
  start.setDate(start.getDate() - (safeDays - 1));
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function buildHref(base: string, current: { q: string; type: ActionType; range: RangeKey }, next: Partial<{ q: string; type: ActionType; range: RangeKey }>) {
  const q = next.q ?? current.q;
  const type = next.type ?? current.type;
  const range = next.range ?? current.range;

  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type !== "all") params.set("type", type);
  if (range !== "30") params.set("range", range);

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; type?: string; range?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = String(sp.q ?? "").trim().toLowerCase();
  const type = (["all", "payment", "checkin"] as ActionType[]).includes(String(sp.type) as ActionType)
    ? (String(sp.type) as ActionType)
    : "all";
  const range = (["7", "30", "60", "90", "all"] as RangeKey[]).includes(String(sp.range) as RangeKey)
    ? (String(sp.range) as RangeKey)
    : "30";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");
  if (staffProfile.role !== "admin") redirect("/dashboard");

  const sinceIso = rangeStartIso(range);

  let payments: PaymentRow[] = [];
  let checkins: CheckinRow[] = [];
  let paymentsErr: string | null = null;
  let checkinsErr: string | null = null;

  if (type === "all" || type === "payment") {
    let paymentsQuery = supabase
      .from("payments")
      .select("id, amount, created_at, paid_on, payment_method, member_id, membership_id, staff_user_id, notes")
      .order("created_at", { ascending: false })
      .limit(500);

    if (sinceIso) {
      paymentsQuery = paymentsQuery.gte("created_at", sinceIso);
    }

    const { data, error } = await paymentsQuery;
    if (error) {
      paymentsErr = error.message;
    } else {
      payments = (data as PaymentRow[]) ?? [];
    }
  }

  if (type === "all" || type === "checkin") {
    let checkinsQuery = supabase
      .from("checkins")
      .select("id, checked_in_at, member_id, staff_user_id, points_earned")
      .order("checked_in_at", { ascending: false })
      .limit(500);

    if (sinceIso) {
      checkinsQuery = checkinsQuery.gte("checked_in_at", sinceIso);
    }

    const { data, error } = await checkinsQuery;
    if (error) {
      checkinsErr = error.message;
    } else {
      checkins = (data as CheckinRow[]) ?? [];
    }
  }

  const membershipIds = Array.from(
    new Set(payments.map((p) => p.membership_id).filter(Boolean).map(String)),
  );

  const membershipToMember = new Map<string, string>();
  if (membershipIds.length) {
    const { data: msRows } = await supabase
      .from("memberships")
      .select("id, member_id")
      .in("id", membershipIds);

    (msRows ?? []).forEach((m: any) => {
      if (m?.id && m?.member_id) membershipToMember.set(String(m.id), String(m.member_id));
    });
  }

  const memberIds = Array.from(
    new Set(
      [
        ...payments.map((p) => p.member_id || (p.membership_id ? membershipToMember.get(String(p.membership_id)) : null)),
        ...checkins.map((c) => c.member_id),
      ]
        .filter(Boolean)
        .map(String),
    ),
  );

  const staffUserIds = Array.from(
    new Set(
      [...payments.map((p) => p.staff_user_id), ...checkins.map((c) => c.staff_user_id)]
        .filter(Boolean)
        .map(String),
    ),
  );

  const membersById = new Map<string, MemberRow>();
  if (memberIds.length) {
    const { data: memberRows } = await supabase
      .from("members")
      .select("id, full_name, email, phone")
      .in("id", memberIds);

    ((memberRows ?? []) as MemberRow[]).forEach((m) => {
      membersById.set(String(m.id), m);
    });
  }

  const staffByUserId = new Map<string, StaffRow>();
  if (staffUserIds.length) {
    const { data: staffRows } = await supabase
      .from("staff_profiles")
      .select("user_id, username, email, role")
      .in("user_id", staffUserIds);

    ((staffRows ?? []) as StaffRow[]).forEach((s) => {
      staffByUserId.set(String(s.user_id), s);
    });
  }

  const events: EventItem[] = [];

  payments.forEach((p) => {
    const memberId = p.member_id || (p.membership_id ? membershipToMember.get(String(p.membership_id)) ?? null : null);
    const amount = Number(p.amount ?? 0);
    const method = p.payment_method || "unknown";
    events.push({
      id: `payment:${p.id}`,
      type: "payment",
      happenedAt: p.created_at || p.paid_on || "",
      memberId,
      staffUserId: p.staff_user_id,
      primary: `Payment recorded: $${amount.toFixed(2)} (${method})`,
      secondary: p.notes ? `Notes: ${p.notes}` : "",
    });
  });

  checkins.forEach((c) => {
    const points = Number(c.points_earned ?? 0);
    events.push({
      id: `checkin:${c.id}`,
      type: "checkin",
      happenedAt: c.checked_in_at || "",
      memberId: c.member_id,
      staffUserId: c.staff_user_id,
      primary: `Check-in recorded${points ? ` (+${points} points)` : ""}`,
      secondary: "",
    });
  });

  const filtered = events
    .filter((e) => {
      if (!q) return true;

      const member = e.memberId ? membersById.get(String(e.memberId)) : null;
      const staff = e.staffUserId ? staffByUserId.get(String(e.staffUserId)) : null;

      const haystack = [
        e.primary,
        e.secondary,
        member?.full_name,
        member?.email,
        member?.phone,
        staff?.username,
        staff?.email,
        roleLabel(staff?.role),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    })
    .sort((a, b) => {
      const ta = parseTs(a.happenedAt)?.getTime() ?? 0;
      const tb = parseTs(b.happenedAt)?.getTime() ?? 0;
      return tb - ta;
    });

  const error = paymentsErr || checkinsErr;
  const base = "/settings/logs";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Activity Logs</h1>
          <p className="text-sm opacity-70">Track employee actions over time (payments and check-ins).</p>
        </div>
        <Link href="/settings" className="rounded border px-3 py-2 text-sm hover:oura-surface-muted">
          Back to Settings
        </Link>
      </div>

      <form action={base} method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          className="w-full oura-input px-3 py-2"
          placeholder="Search member, staff, notes, role…"
        />
        {type !== "all" ? <input type="hidden" name="type" value={type} /> : null}
        {range !== "30" ? <input type="hidden" name="range" value={range} /> : null}
        <button className="rounded border px-3 py-2 text-sm hover:oura-surface-muted">Search</button>
      </form>

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { key: "all", label: "All actions" },
          { key: "payment", label: "Payments" },
          { key: "checkin", label: "Check-ins" },
        ].map((item) => {
          const active = type === item.key;
          return (
            <Link
              key={item.key}
              href={buildHref(base, { q, type, range }, { type: item.key as ActionType })}
              className={["rounded border px-2.5 py-1", active ? "font-semibold" : "opacity-80"].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { key: "7", label: "Last 7 days" },
          { key: "30", label: "Last 30 days" },
          { key: "60", label: "Last 60 days" },
          { key: "90", label: "Last 90 days" },
          { key: "all", label: "All time" },
        ].map((item) => {
          const active = range === item.key;
          return (
            <Link
              key={item.key}
              href={buildHref(base, { q, type, range }, { range: item.key as RangeKey })}
              className={["rounded border px-2.5 py-1", active ? "font-semibold" : "opacity-80"].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {error ? (
        <div className="rounded border p-3 text-sm">
          Could not load activity logs.
          <div className="mt-1 text-xs opacity-70">{error}</div>
        </div>
      ) : null}

      {!error && filtered.length === 0 ? (
        <div className="rounded border p-3 text-sm opacity-70">No activity found for these filters.</div>
      ) : null}

      <div className="space-y-2">
        {filtered.map((e) => {
          const member = e.memberId ? membersById.get(String(e.memberId)) : null;
          const staff = e.staffUserId ? staffByUserId.get(String(e.staffUserId)) : null;

          const memberName = member?.full_name || "Member unknown";
          const memberMeta = [member?.email, member?.phone].filter(Boolean).join(" • ");

          const staffName =
            (staff?.username && staff.username.trim()) ||
            (staff?.email && staff.email.trim()) ||
            "Unknown staff";

          const typeLabel = e.type === "payment" ? "PAYMENT" : "CHECK-IN";

          return (
            <div key={e.id} className="oura-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{e.primary}</div>
                  {e.secondary ? <div className="text-sm opacity-80">{e.secondary}</div> : null}
                  <div className="text-xs opacity-70">{fmtJamaicaDateTime(e.happenedAt)}</div>
                </div>
                <span className="rounded border px-2 py-1 text-[11px] font-semibold tracking-wide">{typeLabel}</span>
              </div>

              <div className="mt-2 text-sm">
                <div>
                  <span className="opacity-70">Member:</span>{" "}
                  {e.memberId ? (
                    <Link href={`/members/${e.memberId}`} className="underline underline-offset-2">
                      {memberName}
                    </Link>
                  ) : (
                    memberName
                  )}
                </div>
                {memberMeta ? <div className="text-xs opacity-70">{memberMeta}</div> : null}
              </div>

              <div className="mt-2 text-sm">
                <span className="opacity-70">Recorded by:</span> {staffName}
                <span className="opacity-60"> ({roleLabel(staff?.role)})</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
