export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Status = "active" | "due_soon" | "past_due";

function ymdJamaica(d: Date) {
  const s = d.toLocaleDateString("en-CA", { timeZone: "America/Jamaica" });
  return s;
}

function jamaicaTodayDateObj() {
  return new Date();
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    activeAccessRes,
    rewardsOnlyRes,
    membershipsRes,
    checkinsTodayRes,
    daily7Res,
    leaderboardRes,
  ] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, membership_plans!inner(grants_access)", { count: "exact", head: true })
      .eq("status", "active")
      .eq("membership_plans.grants_access", true),
    supabase
      .from("memberships")
      .select("id, membership_plans!inner(grants_access)", { count: "exact", head: true })
      .eq("status", "active")
      .eq("membership_plans.grants_access", false),
    supabase
      .from("memberships")
      .select("id, status, needs_contact, paid_through_date, member:members(id)")
      .order("paid_through_date", { ascending: true }),
    supabase
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .gte("checked_in_at", new Date().toISOString().slice(0, 10) + "T00:00:00Z"),
    supabase.from("checkins_daily_7d").select("day_jm, checkins_count"),
    supabase
      .from("member_visit_counts_30d")
      .select("member_id, visits_30d")
      .order("visits_30d", { ascending: false })
      .limit(10),
  ]);

  if (membershipsRes.error) {
    return (
      <div className="rounded border p-3 text-sm">
        Could not load dashboard.
        <div className="mt-1 text-xs opacity-70">{membershipsRes.error.message}</div>
      </div>
    );
  }

  const memberships = (membershipsRes.data ?? []).filter((r) => r.member);

  const count = (s: Status) => memberships.filter((m) => m.status === s).length;
  const needsContactAny = memberships.filter((m) => !!m.needs_contact);
  const pastDueNeedsContact = memberships.filter(
    (m) => m.status === "past_due" && m.needs_contact
  );

  const today = jamaicaTodayDateObj();
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime());
    d.setDate(d.getDate() - i);
    labels.push(ymdJamaica(d));
  }

  const mapCounts = new Map<string, number>();
  (daily7Res.data ?? []).forEach((r: any) => mapCounts.set(String(r.day_jm), Number(r.checkins_count || 0)));

  const series = labels.map((day) => ({
    day,
    count: mapCounts.get(day) ?? 0,
  }));

  const maxCount = Math.max(1, ...series.map((s) => s.count));

  const ids = (leaderboardRes.data ?? []).map((r: any) => r.member_id).filter(Boolean);

  const { data: memberRows } = ids.length
    ? await supabase.from("members").select("id, full_name, phone").in("id", ids)
    : { data: [] as any[] };

  const memberMap = new Map<string, any>();
  (memberRows ?? []).forEach((m: any) => memberMap.set(m.id, m));

  const leaderboard = (leaderboardRes.data ?? []).map((r: any) => ({
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
          <div className="mt-1 text-2xl font-semibold">{activeAccessRes.count ?? 0}</div>
          <div className="mt-1 text-xs opacity-70">Club or Pass</div>
        </Link>

        <Link href="/members?filter=active&access=0" className="block rounded border p-3 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/10">
          <div className="text-xs opacity-70">Rewards Only</div>
          <div className="mt-1 text-2xl font-semibold">{rewardsOnlyRes.count ?? 0}</div>
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

        <Link href="/members?filter=past_due" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Past Due</div>
          <div className="text-2xl font-semibold">{count("past_due")}</div>
        </Link>

        <Link href="/members?filter=needs_contact" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Needs Contact</div>
          <div className="text-2xl font-semibold">{needsContactAny.length}</div>
        </Link>

        <Link href="/checkins" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Check-ins Today</div>
          <div className="text-2xl font-semibold">{checkinsTodayRes.count ?? 0}</div>
        </Link>

        <Link href="/members?filter=past_due_needs_contact" className="col-span-2 rounded border p-3 hover:bg-gray-50 md:col-span-2">
          <div className="text-sm opacity-70">Past Due (Needs Contact)</div>
          <div className="text-2xl font-semibold">{pastDueNeedsContact.length}</div>
        </Link>
      </div>

      <div className="oura-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Weekly check-ins</h2>
          <span className="text-xs opacity-70">Last 7 days (Jamaica)</span>
        </div>

        {daily7Res.error ? (
          <div className="mt-2 text-sm">
            Could not load weekly chart.
            <div className="mt-1 text-xs opacity-70">{daily7Res.error.message}</div>
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

        {leaderboardRes.error ? (
          <div className="mt-2 text-sm">
            Could not load leaderboard.
            <div className="mt-1 text-xs opacity-70">{leaderboardRes.error.message}</div>
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
