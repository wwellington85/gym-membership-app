import { UpgradeOptions } from "@/components/member/upgrade-options";
import { VisitPoints } from "@/components/member/visit-points";
import Link from "next/link";
import { requireMember, loadAccess, loadCatalogue } from "@/lib/access/server";
import { effectiveBenefits } from "@/lib/access/benefits";
import { facilities, upcomingPass } from "@/lib/access/rules";
import { membershipDate } from "@/lib/format/date";

export const dynamic = "force-dynamic";
export default async function BenefitsPage() {
  const { member, admin } = await requireMember();
  const [access, catalogue, pointRows] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(),
    admin.rpc("club_visit_points", { p_member_id: member.id }),
  ]);
  const scheduled = member.is_active ? upcomingPass(access.passes) : null;
  const points = pointRows.error ? null : Number(pointRows.data ?? 0);
  const free = catalogue.find((p) => p.code === "rewards_free");
  const benefits = effectiveBenefits(
    free,
    access.passes,
    member.is_active,
    new Date(),
    member.local_rewards,
  );
  const discounts = benefits.filter((b) => b.percent > 0);
  const ids = member.is_active && free && member.local_rewards ? [free.id] : [];
  const { data: currentExtras, error } = ids.length
    ? await admin
        .from("membership_plan_benefits")
        .select("id, label, value")
        .in("plan_id", ids)
        .eq("is_active", true)
        .order("sort_order")
    : { data: [], error: null };
  const extras = [
    ...(currentExtras ?? []),
    ...access.current.flatMap((p) =>
      (p.plan_snapshot.benefits ?? []).map((b, i) => ({
        ...b,
        id: `${p.id}-${i}`,
      })),
    ),
  ];
  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">Your benefits.</h1>
        <p className="text-sm text-muted-foreground">
          {!member.is_active
            ? "Your visit history stays with you. The front desk can help reactivate your membership."
            : access.best
              ? "Enjoy your Club access, member benefits and visit points."
              : member.local_rewards && member.is_active
                ? "Enjoy Local Rewards discounts and collect points with every visit."
                : scheduled
                  ? "Your next Club pass is booked. Keep collecting points with every visit."
                  : "Collect points when you visit. Explore weekly or monthly Club plans for more benefits."}
        </p>
      </header>
      {!member.is_active && (
        <p role="alert" className="oura-alert-warning">
          Please contact the front desk to reactivate your membership.
        </p>
      )}
      {access.current.length > 0 && (
        <section className="space-y-3" aria-label="Current facility access">
          <h2 className="font-semibold">Your facility access</h2>
          {access.current.map((pass) => (
            <div key={pass.id} className="oura-card space-y-2 p-4">
              <h3 className="font-medium">{pass.plan_snapshot.name}</h3>
              <p className="text-sm">
                {facilities(pass.plan_snapshot).join(" · ")}
              </p>
              <p className="text-sm text-muted-foreground">
                Until {membershipDate(pass.paid_through_date)} at 10 pm
              </p>
            </div>
          ))}
          <Link href="/member/access" className="club-text-link">
            Manage access & renewals
          </Link>
        </section>
      )}
      {discounts.length > 0 && (
        <section className="space-y-3" aria-label="Current discounts">
          <h2 className="font-semibold">Your discounts today</h2>
          <dl className="divide-y divide-border">
            {discounts.map((benefit) => (
              <div key={benefit.key} className="club-rule-row">
                <dt>{benefit.label}</dt>
                <dd className="shrink-0 text-2xl font-semibold tabular-nums">
                  {benefit.percent}% off
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Your best eligible rate applies. Discounts do not stack.
          </p>
          <p className="text-sm">
            Show your card before ordering. Staff can confirm any exclusions.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/member/card" className="club-text-link">
              Show my card
            </Link>
            <Link href="/member/activity" className="club-text-link">
              Discount history
            </Link>
          </div>
        </section>
      )}
      {member.is_active && extras.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">Additional perks</h2>
          {extras.map((b) => (
            <p key={b.id} className="border-b py-3 text-sm">
              {b.label} · {b.value || "Included"}
            </p>
          ))}
        </section>
      )}
      {error && (
        <p role="status" className="text-sm">
          Additional perks could not be loaded. Please check with the front
          desk.
        </p>
      )}
      {scheduled && (
        <p className="oura-card p-4 text-sm">
          Your {scheduled.plan_snapshot.name} starts on{" "}
          {membershipDate(scheduled.start_date)}.{" "}
          <Link href="/member/access" className="underline">
            View upcoming access
          </Link>
        </p>
      )}
      <VisitPoints points={points} active={member.is_active} />
      <UpgradeOptions
        passes={access.passes}
        catalogue={catalogue}
        benefits={benefits}
        active={member.is_active}
        localRewards={member.local_rewards}
      />
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/member/access" className="club-text-link">
          {access.current.length ? "All passes" : "Day passes & other options"}
        </Link>
        <Link href="/member/help" className="club-text-link">
          Membership help
        </Link>
      </div>
    </div>
  );
}
