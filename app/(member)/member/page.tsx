import Link from "next/link";
import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/format/name";
import { computeMembershipStatus, type MembershipTier } from "@/lib/membership/status";
import { Star, CalendarCheck, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

function normalizeTier(planCode?: string | null): MembershipTier {
  const code = String(planCode || "").toLowerCase();
  if (
    code === "rewards_free" ||
    code === "club_day" ||
    code === "club_weekly" ||
    code === "club_monthly_95"
  ) {
    return code as MembershipTier;
  }
  return "rewards_free";
}

function tierLevel(tier?: string | null) {
  const c = String(tier || "").toLowerCase();
  if (c === "club_monthly_95") return 4;
  if (c === "club_weekly") return 3;
  if (c === "club_day") return 2;
  return 1; // rewards_free
}

function fmtJamaicaDate(ts?: string | null) {
  if (!ts) return "—";
  const iso = String(ts);
  const d =
    /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "America/Jamaica" });
}

function daysLeft(ts?: string | null) {
  if (!ts) return null;
  const iso = String(ts);
  const d =
    /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

  const diffMs = target.getTime() - today.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function Bubble({
  value,
  label,
  icon,
}: {
  value: string | number;
  label: string;
  icon?: any;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-20 w-20 rounded-full border border-white/10 bg-gradient-to-b from-indigo-300/10 via-white/4 to-indigo-200/5 backdrop-blur-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_12px_34px_rgba(0,0,0,0.40)]">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(99,102,241,0.16),rgba(168,85,247,0.10))]" />
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_-14px_24px_rgba(0,0,0,0.42)]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {icon ? <div className="mb-1 text-white/80">{icon}</div> : null}
          <div className="font-bubble text-[23px] font-light leading-none tracking-[0.03em] tabular-nums text-white">
            {value}
          </div>
        </div>
      </div>

      <div className="mt-2 text-center text-sm text-white">{label}</div>
    </div>
  );
}

export default async function MemberDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/join");

  const memberId: string = member.id;

  const { data: membership } = await supabase
    .from("memberships")
    .select("paid_through_date, membership_plans(code, name)")
    .eq("member_id", memberId)
    .maybeSingle();

  const planRaw: any = (membership as any)?.membership_plans;
  const plan: any = Array.isArray(planRaw) ? planRaw[0] : planRaw;

  const tier = normalizeTier(plan?.code);
  const computedStatus = computeMembershipStatus({
    tier,
    paid_through: (membership as any)?.paid_through_date ?? null,
  });

  const paidThroughLabel = fmtJamaicaDate((membership as any)?.paid_through_date ?? null);
  const left = daysLeft((membership as any)?.paid_through_date ?? null);

  const statusLabel =
    computedStatus === "active"
      ? "Active"
      : computedStatus === "pending"
      ? "Pending"
      : computedStatus === "expired"
      ? "Expired"
      : "Free";

  const statusHint =
    computedStatus === "active"
      ? left === null
        ? "Enjoy full access."
        : left <= 1
        ? `Renews in ${Math.max(left, 0)} day`
        : `Renews in ${left} days`
      : computedStatus === "pending"
      ? "Payment needed to activate."
      : computedStatus === "expired"
      ? "Renew to regain access."
      : "Limited perks only.";

  const ctaHref =
    computedStatus === "active"
      ? "/member/card"
      : computedStatus === "pending" || computedStatus === "expired"
      ? "/member/payments"
      : "/member/settings";

  const ctaLabel =
    computedStatus === "active"
      ? "View card"
      : computedStatus === "pending" || computedStatus === "expired"
      ? "Pay / Renew"
      : "Choose plan";

  // Recent check-ins (resilient: tries a few common table/column combos)
  let recentCheckins: any[] = [];
  let totalCheckins = 0;
  let points = 0;

  async function fetchCheckins() {
    const attempts: Array<[string, string, string]> = [
      ["member_checkins", "checked_in_at", "points_earned"],
      ["member_checkins", "created_at", "points_earned"],
      ["checkins", "checked_in_at", "points_earned"],
      ["checkins", "created_at", "points_earned"],
      ["member_check_ins", "checked_in_at", "points_earned"],
      ["member_check_ins", "created_at", "points_earned"],
    ];

    for (const [table, timeCol, pointsCol] of attempts) {
      const recentRes = await supabase
        .from(table)
        .select(`id, ${timeCol}, ${pointsCol}`)
        .eq("member_id", memberId)
        .order(timeCol, { ascending: false })
        .limit(5);

      if (recentRes.error) continue;

      const rows = (recentRes.data ?? []).map((r: any) => ({
        ...r,
        checked_in_at: r.checked_in_at ?? r[timeCol],
        points_earned: r.points_earned ?? r[pointsCol],
      }));

      // total count from same table
      const countRes = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("member_id", memberId);

      return {
        rows,
        count: Number(countRes.count ?? 0),
      };
    }

    return { rows: [], count: 0 };
  }

  const fetched = await fetchCheckins();
  recentCheckins = fetched.rows;
  totalCheckins = fetched.count;
  points = recentCheckins.reduce((acc: number, r: any) => acc + Number(r?.points_earned ?? 0), 0);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full">
<h1 className="text-xl font-semibold">Travellers Club Dashboard</h1>
          <p className="text-sm opacity-70">Welcome, {firstName(member.full_name)}</p>

          <div className="mt-4 flex w-full justify-center">
  <div className="mx-auto grid w-full max-w-[560px] grid-cols-3 place-items-center gap-6">
<Bubble
                  value={points ?? 0}
                  label="Loyalty points"
                  icon={<Star className="h-4 w-4" strokeWidth={2} />}
                />
                <Bubble
                  value={totalCheckins ?? 0}
                  label="Total check-ins"
                  icon={<CalendarCheck className="h-4 w-4" strokeWidth={2} />}
                />
                <Bubble
                  value={tierLevel(tier)}
                  label="Tier level"
                  icon={<Layers className="h-4 w-4" strokeWidth={2} />}
                />
  </div>
</div>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">Membership</div>
          <Link
            className="text-sm opacity-80 hover:opacity-100 hover:underline underline-offset-4"
            href="/member/card?returnTo=/member"
          >
            View card
          </Link>
        </div>

        <div className="mt-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  computedStatus === "active"
                    ? "bg-green-50"
                    : computedStatus === "pending"
                    ? "bg-yellow-50"
                    : computedStatus === "expired"
                    ? "bg-red-50"
                    : "oura-surface-muted",
                ].join(" ")}
              >
                {statusLabel}
              </span>
              <span className="text-xs opacity-70">{statusHint}</span>
            </div>

            <Link className="rounded border px-3 py-2 text-xs hover:oura-surface-muted" href={ctaHref}>
              {ctaLabel}
            </Link>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-x-10 gap-y-3 text-sm">
            <div>
              <div className="opacity-70">Plan</div>
              <div className="font-medium">{plan?.name ?? (computedStatus === "free" ? "Free" : "—")}</div>
            </div>

            <div className="text-right">
              <div className="opacity-70">Paid through</div>
              <div className="font-medium">{paidThroughLabel}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded border oura-surface-muted p-3 text-sm">
          <div className="font-medium">Your benefits</div>
          <div className="mt-1 opacity-80">
            See your discounts and access details in{" "}
            <Link className="underline" href="/member/benefits">
              Benefits
            </Link>
            .
          </div>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">Recent check-ins</div>

        {(recentCheckins ?? []).length === 0 ? (
          <div className="mt-2 text-sm opacity-70">No check-ins yet.</div>
        ) : (
          <div className="mt-2 divide-y divide-white/10">
            {(recentCheckins ?? []).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div className="opacity-90">{fmtJamaicaDate(c.checked_in_at)}</div>
                <div className="font-medium text-indigo-200">+{c.points_earned ?? 0} pts</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

