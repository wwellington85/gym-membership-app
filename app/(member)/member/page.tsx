import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function fmtJamaica(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/Jamaica" });
}

export default async function MemberDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Member row linked to auth.users.id via members.user_id
  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone, email, created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Travellers Club</h1>
        <div className="rounded border p-3 text-sm">
          We couldn’t find a membership profile linked to this login yet.
          <div className="mt-2 flex gap-2">
            <Link className="rounded border px-3 py-2 text-sm hover:bg-gray-50" href="/join">
              Join Travellers Club
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select(
      "id, status, start_date, paid_through_date, membership_plans(name, code, price, duration_days)"
    )
    .eq("member_id", member.id)
    .maybeSingle();

  const planRaw: any = (membership as any)?.membership_plans;
  const plan: any = Array.isArray(planRaw) ? planRaw[0] : planRaw;

  const { data: loyalty } = await supabase
    .from("member_loyalty_points")
    .select("points")
    .eq("member_id", member.id)
    .maybeSingle();

  const { count: checkinsCount } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("member_id", member.id);

  const { data: recentCheckins } = await supabase
    .from("checkins")
    .select("id, checked_in_at, points_earned")
    .eq("member_id", member.id)
    .order("checked_in_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Travellers Club Dashboard</h1>
        <p className="text-sm opacity-70">Welcome, {member.full_name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Loyalty points</div>
          <div className="mt-1 text-2xl font-semibold">{loyalty?.points ?? 0}</div>
        </div>
        <div className="rounded border p-3">
          <div className="text-xs opacity-70">Total check-ins</div>
          <div className="mt-1 text-2xl font-semibold">{checkinsCount ?? 0}</div>
        </div>
      </div>

      <div className="rounded border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Membership</div>
          <Link className="text-sm underline opacity-80" href="/member/card">
            View card
          </Link>
        </div>

        <div className="mt-2 text-sm">
          <div className="opacity-70">Plan</div>
          <div className="font-medium">{plan?.name ?? "—"}</div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="opacity-70">Status</div>
              <div className="font-medium">{membership?.status ?? "—"}</div>
            </div>
            <div>
              <div className="opacity-70">Paid through</div>
              <div className="font-medium">{membership?.paid_through_date ?? "—"}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded border bg-gray-50 p-3 text-sm">
          <div className="font-medium">Your benefits</div>
          <div className="mt-1 opacity-80">
            See your discounts and access details in <Link className="underline" href="/member/benefits">Benefits</Link>.
          </div>
        </div>
      </div>

      <div className="rounded border p-3">
        <div className="font-medium">Recent check-ins</div>
        {(recentCheckins ?? []).length === 0 ? (
          <div className="mt-2 text-sm opacity-70">No check-ins yet.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {(recentCheckins ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded border p-2">
                <div className="text-sm">{fmtJamaica(c.checked_in_at)}</div>
                <div className="text-sm opacity-70">+{c.points_earned ?? 0} pts</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
