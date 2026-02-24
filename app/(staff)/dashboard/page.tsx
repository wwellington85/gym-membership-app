export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deriveStaffMembershipStatus } from "@/lib/membership/status";

type Status = "active" | "due_soon" | "past_due";

function ymdJamaica(d: Date) {
  const s = d.toLocaleDateString("en-CA", { timeZone: "America/Jamaica" });
  return s;
}

function jamaicaTodayDateObj() {
  return new Date();
}

function jamaicaDayRangeUtc(base = new Date()) {
  const offsetMs = 5 * 60 * 60 * 1000; // Jamaica UTC-5
  const jmLocal = new Date(base.getTime() - offsetMs);
  jmLocal.setHours(0, 0, 0, 0);
  const startUtc = new Date(jmLocal.getTime() + offsetMs);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

function ymdToUtcMs(ymd?: string | null) {
  const v = String(ymd ?? "");
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { startUtc: todayStartUtc, endUtc: todayEndUtc } = jamaicaDayRangeUtc();
  const dayMs = 24 * 60 * 60 * 1000;
  const start30Utc = new Date(todayStartUtc.getTime() - 29 * dayMs);

  const [
    membershipsRes,
    checkinsRecentRes,
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, status, needs_contact, paid_through_date, start_date, downgraded_on, downgraded_from_plan_code, membership_plans(duration_days, grants_access, code), member:members(id)")
      .order("paid_through_date", { ascending: true }),
    supabase
      .from("checkins")
      .select("member_id, checked_in_at")
      .gte("checked_in_at", start30Utc.toISOString())
      .lt("checked_in_at", todayEndUtc.toISOString())
      .order("checked_in_at", { ascending: false })
      .limit(10000),
  ]);

  if (membershipsRes.error) {
    return (
      <div className="rounded border p-3 text-sm">
        Could not load dashboard.
        <div className="mt-1 text-xs opacity-70">{membershipsRes.error.message}</div>
      </div>
    );
  }

  const memberships = (membershipsRes.data ?? [])
    .filter((r) => r.member)
    .map((m: any) => {
      const planRaw: any = m?.membership_plans;
      const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
      const derivedStatus = deriveStaffMembershipStatus({
        status: m?.status ?? null,
        startDate: m?.start_date ?? null,
        paidThroughDate: m?.paid_through_date ?? null,
        durationDays: plan?.duration_days ?? null,
      });
      return { ...m, derivedStatus };
    });
  const activeAccessCount = memberships.filter((m: any) => {
    const planRaw: any = m?.membership_plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    return m.derivedStatus === "active" && !!plan?.grants_access;
  }).length;
  const rewardsOnlyCount = memberships.filter((m: any) => {
    const planRaw: any = m?.membership_plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    return m.derivedStatus === "active" && !plan?.grants_access;
  }).length;

  const count = (s: Status) => memberships.filter((m: any) => m.derivedStatus === s).length;
  const needsContactAny = memberships.filter((m: any) => !!m.needs_contact);
  const isDowngraded = (m: any) => {
    const planRaw: any = m?.membership_plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    const planCode = String(plan?.code ?? "").toLowerCase();
    return planCode === "rewards_free" && !!m?.downgraded_from_plan_code;
  };
  const downgradedToRewardsCount = memberships.filter((m: any) => isDowngraded(m)).length;
  const downgraded7dCount = memberships.filter((m: any) => {
    if (!isDowngraded(m)) return false;
    const ms = ymdToUtcMs(m?.downgraded_on);
    if (ms == null) return false;
    return ms >= todayStartUtc.getTime() - 6 * dayMs && ms < todayEndUtc.getTime();
  }).length;

  const today = jamaicaTodayDateObj();
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime());
    d.setDate(d.getDate() - i);
    labels.push(ymdJamaica(d));
  }

  const checkins30d = checkinsRecentRes.data ?? [];
  const checkinsAggError = checkinsRecentRes.error?.message ?? null;

  const mapCounts = new Map<string, number>();
  const visits30Map = new Map<string, number>();
  let checkinsTodayCount = 0;

  checkins30d.forEach((r: any) => {
    const ts = new Date(String(r.checked_in_at)).getTime();
    if (Number.isNaN(ts)) return;

    if (ts >= todayStartUtc.getTime() && ts < todayEndUtc.getTime()) {
      checkinsTodayCount += 1;
    }

    const dayKey = ymdJamaica(new Date(ts));
    if (labels.includes(dayKey)) {
      mapCounts.set(dayKey, (mapCounts.get(dayKey) ?? 0) + 1);
    }

    const memberId = String(r.member_id ?? "");
    if (memberId) {
      visits30Map.set(memberId, (visits30Map.get(memberId) ?? 0) + 1);
    }
  });

  const series = labels.map((day) => ({
    day,
    count: mapCounts.get(day) ?? 0,
  }));

  const maxCount = Math.max(1, ...series.map((s) => s.count));

  const leaderboardRows = Array.from(visits30Map.entries())
    .map(([member_id, visits_30d]) => ({ member_id, visits_30d }))
    .sort((a, b) => b.visits_30d - a.visits_30d)
    .slice(0, 10);

  const ids = leaderboardRows.map((r) => r.member_id).filter(Boolean);

  const { data: memberRows } = ids.length
    ? await supabase.from("members").select("id, full_name, phone").in("id", ids)
    : { data: [] as any[] };

  const memberMap = new Map<string, any>();
  (memberRows ?? []).forEach((m: any) => memberMap.set(m.id, m));

  const leaderboard = leaderboardRows.map((r: any) => ({
    member_id: r.member_id,
    visits_30d: Number(r.visits_30d || 0),
    member: memberMap.get(r.member_id),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Travellers Club Dashboard</h1>
        <p className="text-sm opacity-70">Membership + gym activity overview</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Link href="/members?filter=active&access=1" className="block rounded border p-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10">
          <div className="text-xs opacity-70">Active Access</div>
          <div className="mt-1 text-2xl font-semibold">{activeAccessCount}</div>
          <div className="mt-1 text-xs opacity-70">Club or Pass</div>
        </Link>

        <Link href="/members?filter=active&access=0" className="block rounded border p-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10">
          <div className="text-xs opacity-70">Rewards Only</div>
          <div className="mt-1 text-2xl font-semibold">{rewardsOnlyCount}</div>
          <div className="mt-1 text-xs opacity-70">Discounts only</div>
        </Link>

        <Link href="/members?filter=active" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Total Active (All)</div>
          <div className="text-2xl font-semibold">{count("active")}</div>
        </Link>

        <Link href="/members?filter=due_soon" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Due Soon</div>
          <div className="text-2xl font-semibold">{count("due_soon")}</div>
        </Link>

        <Link href="/members?filter=downgraded" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Downgraded to Rewards</div>
          <div className="text-2xl font-semibold">{downgradedToRewardsCount}</div>
        </Link>

        <Link href="/members?filter=needs_contact" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Needs Contact</div>
          <div className="text-2xl font-semibold">{needsContactAny.length}</div>
        </Link>

        <Link href="/checkins" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Check-ins Today</div>
          <div className="text-2xl font-semibold">{checkinsTodayCount}</div>
        </Link>

        <Link href="/members?filter=downgraded&downgraded_days=7" className="col-span-2 rounded border p-3 hover:bg-gray-50 md:col-span-2">
          <div className="text-sm opacity-70">Downgraded (last 7 days)</div>
          <div className="text-2xl font-semibold">{downgraded7dCount}</div>
        </Link>
      </div>

      <div className="oura-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Weekly check-ins</h2>
          <span className="text-xs opacity-70">Last 7 days (Jamaica)</span>
        </div>

        {checkinsAggError ? (
          <div className="mt-2 text-sm">
            Could not load weekly chart.
            <div className="mt-1 text-xs opacity-70">{checkinsAggError}</div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {series.map((s) => (
              <div key={s.day} className="flex items-center gap-2">
                <div className="w-20 text-xs opacity-70">{s.day.slice(5)}</div>
                <div className="flex-1 rounded border bg-white">
                  <div className="h-3 rounded" style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }} />
                </div>
                <div className="w-8 text-right text-xs opacity-70">{s.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="oura-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Top members</h2>
          <span className="text-xs opacity-70">Visits (last 30 days)</span>
        </div>

        {checkinsAggError ? (
          <div className="mt-2 text-sm">
            Could not load leaderboard.
            <div className="mt-1 text-xs opacity-70">{checkinsAggError}</div>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="mt-2 text-sm opacity-70">No check-ins yet.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {leaderboard.slice(0, 10).map((row, idx) => (
              <Link key={row.member_id} href={row.member_id ? `/members/${row.member_id}` : "#"} className="block rounded border p-3 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm opacity-70">#{idx + 1}</div>
                    <div className="font-medium">{row.member?.full_name ?? "Member"}</div>
                    <div className="text-xs opacity-70">{row.member?.phone ?? ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm opacity-70">Visits</div>
                    <div className="text-xl font-semibold">{row.visits_30d}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
