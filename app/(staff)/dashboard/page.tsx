export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Status = "active" | "due_soon" | "past_due";

function ymdJamaica(d: Date) {
  // Force Jamaica day label in YYYY-MM-DD
  const s = d.toLocaleDateString("en-CA", { timeZone: "America/Jamaica" });
  return s; // en-CA gives YYYY-MM-DD
}

function jamaicaTodayDateObj() {
  // Create a Date that represents "now", but we only use it to generate Jamaica day strings
  return new Date();
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: membershipsRows, error: membershipsErr } = await supabase
    .from("memberships")
    .select("id, status, needs_contact, paid_through_date, member:members(id)")
    .order("paid_through_date", { ascending: true });

  if (membershipsErr) {
    return (
      <div className="rounded border p-3 text-sm">
        Could not load dashboard.
        <div className="mt-1 text-xs opacity-70">{membershipsErr.message}</div>
      </div>
    );
  }

  const memberships = (membershipsRows ?? []).filter((r) => r.member);

  const count = (s: Status) => memberships.filter((m) => m.status === s).length;
  const needsContactAny = memberships.filter((m) => !!m.needs_contact);
  const pastDueNeedsContact = memberships.filter(
    (m) => m.status === "past_due" && m.needs_contact
  );

  // Check-ins today count (based on view later, but keep quick count)
  const { count: checkinsTodayCount } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .gte("checked_in_at", new Date().toISOString().slice(0, 10) + "T00:00:00Z"); // good enough for a quick count

  // Weekly chart data (Jamaica days)
  const { data: daily7, error: dailyErr } = await supabase
    .from("checkins_daily_7d")
    .select("day_jm, checkins_count");

  // Fill missing days so chart always shows 7 bars
  const today = jamaicaTodayDateObj();
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime());
    d.setDate(d.getDate() - i);
    labels.push(ymdJamaica(d));
  }

  const mapCounts = new Map<string, number>();
  (daily7 ?? []).forEach((r: any) => mapCounts.set(String(r.day_jm), Number(r.checkins_count || 0)));

  const series = labels.map((day) => ({
    day,
    count: mapCounts.get(day) ?? 0,
  }));

  const maxCount = Math.max(1, ...series.map((s) => s.count));

  // Leaderboard (top 10 in last 30d)
  const { data: leaderboardRaw, error: lbErr } = await supabase
    .from("member_visit_counts_30d")
    .select("member_id, visits_30d")
    .order("visits_30d", { ascending: false })
    .limit(10);

  const ids = (leaderboardRaw ?? []).map((r: any) => r.member_id).filter(Boolean);

  const { data: memberRows } = ids.length
    ? await supabase
        .from("members")
        .select("id, full_name, phone")
        .in("id", ids)
    : { data: [] as any[] };

  const memberMap = new Map<string, any>();
  (memberRows ?? []).forEach((m: any) => memberMap.set(m.id, m));

  const leaderboard = (leaderboardRaw ?? []).map((r: any) => ({
    member_id: r.member_id,
    visits_30d: Number(r.visits_30d || 0),
    member: memberMap.get(r.member_id),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm opacity-70">Membership + gym activity overview</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/members?filter=active" className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Active</div>
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
          <div className="text-2xl font-semibold">{checkinsTodayCount ?? 0}</div>
        </Link>

        <Link
          href="/members?filter=past_due_needs_contact"
          className="rounded border p-3 hover:bg-gray-50 col-span-2"
        >
          <div className="text-sm opacity-70">Past Due (Needs Contact)</div>
          <div className="text-2xl font-semibold">{pastDueNeedsContact.length}</div>
        </Link>
      </div>

      {/* Weekly chart */}
      <div className="rounded border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Weekly check-ins</h2>
          <span className="text-xs opacity-70">Last 7 days (Jamaica)</span>
        </div>

        {dailyErr ? (
          <div className="mt-2 text-sm">
            Could not load weekly chart.
            <div className="mt-1 text-xs opacity-70">{dailyErr.message}</div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {series.map((s) => (
              <div key={s.day} className="flex items-center gap-2">
                <div className="w-20 text-xs opacity-70">{s.day.slice(5)}</div>
                <div className="flex-1 rounded border bg-white">
                  <div
                    className="h-3 rounded"
                    style={{ width: `${Math.round((s.count / maxCount) * 100)}%` }}
                  />
                </div>
                <div className="w-8 text-right text-xs opacity-70">{s.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="rounded border p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Top members</h2>
          <span className="text-xs opacity-70">Visits (last 30 days)</span>
        </div>

        {lbErr ? (
          <div className="mt-2 text-sm">
            Could not load leaderboard.
            <div className="mt-1 text-xs opacity-70">{lbErr.message}</div>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="mt-2 text-sm opacity-70">No check-ins yet.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {leaderboard.slice(0, 10).map((row, idx) => (
              <Link
                key={row.member_id}
                href={row.member_id ? `/members/${row.member_id}` : "#"}
                className="block rounded border p-3 hover:bg-gray-50"
              >
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
