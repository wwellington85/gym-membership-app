import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const { data: rows, error } = await supabase
    .from("checkins")
    .select("id, checked_in_at, points_earned")
    .eq("member_id", member.id)
    .order("checked_in_at", { ascending: false })
    .limit(50);

  const totalCheckins = Number(rows?.length ?? 0);
  const totalPoints = (rows ?? []).reduce(
    (sum, row: any) => sum + Number(row?.points_earned ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Your Club visits</h1>
          <p className="text-sm text-muted-foreground">
            Verified visits recorded by staff. Earn 3 points for one visit per
            Jamaica calendar day, checked in by staff at the front gate or
            restaurant.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="oura-alert-warning">
          Visit history is temporarily unavailable. Please try again.
        </p>
      )}
      {!error && (
        <div className="grid grid-cols-2 gap-3">
          <div className="oura-card p-3">
            <div className="text-sm text-muted-foreground">Recent history</div>
            <div className="mt-1 text-2xl font-semibold">{totalCheckins}</div>
            <div className="text-xs text-muted-foreground">
              latest 50 check-ins
            </div>
          </div>
          <div className="oura-card p-3">
            <div className="text-sm text-muted-foreground">
              Points from these visits
            </div>
            <div className="mt-1 text-2xl font-semibold">{totalPoints}</div>
            <div className="text-xs text-muted-foreground">
              based on recorded visit points
            </div>
          </div>
        </div>
      )}

      <div className="oura-card p-3">
        <div className="font-medium">Check-in history</div>
        {error ? (
          <p className="mt-2 text-sm">We could not load your visits.</p>
        ) : rows?.length ? (
          <div className="mt-3 divide-y divide-border">
            {rows.map((row: any) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="text-foreground">
                  {fmtJamaicaDateTime(row.checked_in_at)}
                </div>
                <div className="font-medium text-primary">
                  +{Number(row.points_earned ?? 0)} pts
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-sm text-muted-foreground">
            No check-ins recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
