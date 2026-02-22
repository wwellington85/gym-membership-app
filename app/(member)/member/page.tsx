import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/lib/format/name";
import { computeMembershipStatus, type MembershipTier } from "@/lib/membership/status";
import {
  getCurrentUnseenRenewalNotifications,
  markCurrentRenewalNotificationsSeen,
  queueRenewalNotificationsForMembership,
  renewalMessageForDays,
} from "@/lib/membership/renewal-notifications";
import { Star, CalendarCheck, Layers } from "lucide-react";

function normalizeTier(planCode?: string | null): MembershipTier {
  const code = String(planCode || "").toLowerCase();
  if (code === "rewards_free" || code === "club_day" || code === "club_weekly" || code === "club_monthly_95") {
    return code as MembershipTier;
  }
  return "rewards_free";
}

function tierLevel(tier?: string | null) {
  const c = String(tier || "").toLowerCase();
  if (c === "club_monthly_95") return 4;
  if (c === "club_weekly") return 3;
  if (c === "club_day") return 2;
  return 1;
}

function fmtJamaicaDate(ts?: string | null) {
  if (!ts) return "—";
  const iso = String(ts);
  const d =
    /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "America/Jamaica" });
}

function ymdJamaica() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysUntilJamaica(isoDate?: string | null) {
  const target = String(isoDate ?? "").slice(0, 10);
  if (!target) return null;
  const today = ymdJamaica();
  const a = new Date(`${today}T00:00:00.000Z`);
  const b = new Date(`${target}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}


function Bubble({
  value,
  label,
  icon,
  href,
}: {
  value: string | number;
  label: string;
  icon: React.ReactNode;
  href?: string;
}) {
  const content = (
    <div className="flex flex-col items-center">
      <div className="relative h-20 w-20 rounded-full border border-white/10 bg-gradient-to-b from-indigo-300/12 via-white/4 to-indigo-200/6 backdrop-blur-md shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_10px_28px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(135deg,rgba(99,102,241,0.22),rgba(168,85,247,0.14))]" />
        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),transparent_58%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_-14px_24px_rgba(0,0,0,0.42)]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="mb-1 text-white/85">{icon}</div>
          <div className="font-bubble text-[23px] font-light leading-none tracking-[0.03em] tabular-nums text-white">
            {value}
          </div>
        </div>
      </div>

      <div className="mt-2 min-h-[2.5rem] max-w-[120px] text-center text-[13px] leading-tight text-white/90">{label}</div>
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      prefetch={false}
      className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
      aria-label={label}
    >
      {content}
    </Link>
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

  // Membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, status, paid_through, plan_code, downgraded_from_plan_name, downgraded_on, membership_plans(code, name)")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .maybeSingle();

  console.log("[/member] membership raw:", membership);
  const membershipRow: any = Array.isArray(membership) ? membership[0] : membership;


  const tier = normalizeTier(membership?.plan_code ?? "rewards_free");

  const computedStatus = computeMembershipStatus({
    tier,
    paid_through: membership?.paid_through ?? null,
    db_status: membership?.status ?? null,
  });

  const isFree = computedStatus === "free";

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
      ? "Enjoy your access + discounts"
      : computedStatus === "pending"
      ? "We’re confirming your membership"
      : computedStatus === "expired"
      ? "Renew to regain access"
      : "Discounts only (no facility access)";
  const paidThroughLabel =
    computedStatus === "free"
      ? "N/A"
      : membershipRow?.paid_through
      ? fmtJamaicaDate(membershipRow.paid_through)
      : "—";
  const paidThroughIso = String(membershipRow?.paid_through ?? "").slice(0, 10);

  async function dismissRenewalNotice() {
    "use server";
    const supabase = await createClient();
    await markCurrentRenewalNotificationsSeen({
      supabase,
      memberId,
      paidThroughDate: paidThroughIso,
    });
    redirect("/member");
  }

  if (!isFree && membershipRow?.id && paidThroughIso) {
    await queueRenewalNotificationsForMembership({
      supabase,
      memberId,
      membershipId: String(membershipRow.id),
      paidThroughDate: paidThroughIso,
    });
  }

  const renewalNotices =
    !isFree && paidThroughIso
      ? await getCurrentUnseenRenewalNotifications({
          supabase,
          memberId,
          paidThroughDate: paidThroughIso,
        })
      : [];

  const daysLeft = daysUntilJamaica(paidThroughIso);
  const hasRenewalNotice = renewalNotices.length > 0 && daysLeft !== null && daysLeft <= 14;
  const renewalNoticeTone =
    daysLeft !== null && daysLeft <= 3 ? "border-amber-300 bg-amber-50" : "border-sky-300 bg-sky-50";
  const renewalNoticeTextTone = daysLeft !== null && daysLeft <= 3 ? "text-amber-900" : "text-sky-900";
  // Check-ins (try multiple table/column combos so it works regardless of naming)
  async function fetchCheckins() {
    const candidates = [
      { table: "checkins", timeCol: "checked_in_at", pointsCol: "points_earned" },
      { table: "member_checkins", timeCol: "checked_in_at", pointsCol: "points_earned" },
      { table: "gym_checkins", timeCol: "checked_in_at", pointsCol: "points_earned" },
      { table: "check_ins", timeCol: "checked_in_at", pointsCol: "points_earned" },
      { table: "checkins", timeCol: "created_at", pointsCol: "points" },
    ];

    for (const c of candidates) {
      const recentRes = await supabase
        .from(c.table)
        // @ts-ignore
        .select(`id, ${c.timeCol}, ${c.pointsCol}`)
        // @ts-ignore
        .eq("member_id", memberId)
        // @ts-ignore
        .order(c.timeCol, { ascending: false })
        // @ts-ignore
        .limit(5);

      if (!recentRes.error) {
        const rows = (recentRes.data ?? []).map((r: any) => ({
          id: r.id,
          checked_in_at: r.checked_in_at ?? r[c.timeCol],
          points_earned: r.points_earned ?? r[c.pointsCol] ?? 0,
        }));

        const countRes = await supabase
          .from(c.table)
          .select("id", { count: "exact", head: true })
          // @ts-ignore
          .eq("member_id", memberId);

        return { rows, count: Number(countRes.count ?? 0) };
      }
    }

    return { rows: [], count: 0 };
  }

  const fetched = await fetchCheckins();
  const recentCheckins = fetched.rows;
  const totalCheckins = fetched.count;
  const points = recentCheckins.reduce((acc: number, r: any) => acc + Number(r?.points_earned ?? 0), 0);

  // Plan display (simple mapping)
  const planName =
    tier === "club_monthly_95"
      ? "Travellers Club Monthly"
      : tier === "club_weekly"
      ? "Travellers Club Weekly Pass"
      : tier === "club_day"
      ? "Travellers Club Day Pass"
      : "Travellers Rewards";

  const ctaHref =
    computedStatus === "active"
      ? "/member/settings"
      : computedStatus === "pending"
      ? "/member/settings"
      : "/member/upgrade";

  const ctaLabel =
    computedStatus === "active"
      ? "Manage"
      : computedStatus === "pending"
      ? "View status"
      : "Upgrade";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="w-full">
          <h1 className="text-xl font-semibold">Travellers Club Dashboard</h1>
          <p className="text-sm opacity-70">Welcome, {firstName(member.full_name)}</p>

          <div className="mt-4 w-full">
            
              <div className="flex w-full justify-center">
                <div className="mx-auto grid w-full max-w-[520px] grid-cols-3 place-items-center gap-6">
  <Link
    href="/member/points"
    className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
  >
    <Bubble
      value={points ?? 0}
      label="Loyalty points"
      icon={<Star className="h-4 w-4" strokeWidth={1.75} />}
    />
  </Link>

  <Link
    href="/member/check-ins"
    className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
  >
    <Bubble
      value={totalCheckins ?? 0}
      label="Total check-ins"
      icon={<CalendarCheck className="h-4 w-4" strokeWidth={1.75} />}
    />
  </Link>

  <Link
    href="/member/tier"
    className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
  >
    <Bubble
      value={tierLevel(tier)}
      label="Tier level"
      icon={<Layers className="h-4 w-4" strokeWidth={1.75} />}
    />
  </Link>

              </div>
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

          <div className={["grid gap-2 text-sm", isFree ? "grid-cols-1" : "grid-cols-2"].join(" ")}>
            <div>
              <div className="opacity-70">Plan</div>
              <div className="font-medium">{planName}</div>
            </div>
            {!isFree && (
<div className="text-right">
              <div className="opacity-70">Paid through</div>
              <div className="font-medium">{paidThroughLabel}</div>
            </div>
            )}

          </div>

          {isFree && membershipRow?.downgraded_from_plan_name ? (
            <div className="text-xs opacity-75">
              Previous paid plan: {membershipRow.downgraded_from_plan_name}
              {membershipRow?.downgraded_on ? ` (expired ${membershipRow.downgraded_on})` : ""}
            </div>
          ) : null}
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

      {hasRenewalNotice ? (
        <div className={["rounded border p-3 text-sm", renewalNoticeTone, renewalNoticeTextTone].join(" ")}>
          <div className="font-medium">Renewal reminder</div>
          <div className="mt-1">
            {renewalMessageForDays(daysLeft ?? 0, paidThroughLabel)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/member/settings" className="rounded border px-3 py-2 text-xs hover:bg-white/40">
              Renew now
            </Link>
            <form action={dismissRenewalNotice}>
              <button className="rounded border px-3 py-2 text-xs hover:bg-white/40" type="submit">
                Dismiss
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <div className="oura-card p-3">
        <div className="font-medium">Recent check-ins</div>

        {(() => {
          const rows = recentCheckins ?? [];
          if (rows.length === 0) {
            return <div className="mt-2 text-sm opacity-70">No check-ins yet.</div>;
          }
          return (
            <div className="mt-2 divide-y divide-white/10">
              {rows.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="opacity-90">{fmtJamaicaDate(c.checked_in_at)}</div>
                  <div className="font-medium text-indigo-200">+{c.points_earned ?? 0} pts</div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
