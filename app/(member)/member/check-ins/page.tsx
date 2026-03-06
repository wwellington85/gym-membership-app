import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";

function fmtJamaicaDateTime(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(String(ts));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Jamaica",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MemberCheckinsInfoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member?.id) redirect("/join");

  const { data: rows } = await supabase
    .from("checkins")
    .select("id, checked_in_at, points_earned")
    .eq("member_id", member.id)
    .order("checked_in_at", { ascending: false })
    .limit(50);

  const totalCheckins = Number(rows?.length ?? 0);
  const totalPoints = (rows ?? []).reduce((sum, row: any) => sum + Number(row?.points_earned ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Check-ins</h1>
          <p className="text-sm opacity-70">
            Verified visits recorded by staff. Most check-ins earn points automatically.
          </p>
        </div>
        <BackButton fallbackHref="/member" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="oura-card p-3">
          <div className="text-sm opacity-70">Recent history</div>
          <div className="mt-1 text-2xl font-semibold">{totalCheckins}</div>
          <div className="text-xs opacity-70">latest 50 check-ins</div>
        </div>
        <div className="oura-card p-3">
          <div className="text-sm opacity-70">Points from these visits</div>
          <div className="mt-1 text-2xl font-semibold">{totalPoints}</div>
          <div className="text-xs opacity-70">based on recorded visit points</div>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">Check-in history</div>
        {rows?.length ? (
          <div className="mt-3 divide-y divide-white/10">
            {rows.map((row: any) => (
              <div key={row.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="opacity-90">{fmtJamaicaDateTime(row.checked_in_at)}</div>
                <div className="font-medium text-indigo-200">+{Number(row.points_earned ?? 0)} pts</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm opacity-70">No check-ins recorded yet.</div>
        )}
      </div>
    </div>
  );
}
