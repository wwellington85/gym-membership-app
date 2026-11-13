import Link from "next/link";
import { ArrowRight, Dumbbell } from "lucide-react";
import { requireMember, loadAccess, loadCatalogue } from "@/lib/access/server";
import { firstName } from "@/lib/format/name";
import { effectiveBenefits } from "@/lib/access/benefits";
import { membershipDate } from "@/lib/format/date";
import { MembershipCard } from "@/components/member/membership-card";

export const dynamic = "force-dynamic";
export default async function MemberHome() {
  const { member } = await requireMember();
  const [access, catalogue] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(),
  ]);
  const benefits = effectiveBenefits(
    catalogue.find((plan) => plan.code === "rewards_free"),
    access.passes,
    member.is_active,
  );
  return (
    <div className="space-y-6">
      <header>
        <h1>Welcome back, {firstName(member.full_name)}.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your membership, always with you.
        </p>
      </header>
      {!member.is_active && (
        <p role="alert" className="oura-alert-warning">
          Please contact the front desk about your membership. Benefits and
          access need verification.
        </p>
      )}
      <MembershipCard
        memberId={member.id}
        name={member.full_name}
        active={member.is_active}
        product={access.best?.plan_snapshot.name}
        validThrough={access.best?.paid_through_date}
        showCardLink
      />
      {member.is_active && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Your benefits today</h2>
            <Link href="/member/benefits" className="club-text-link">
              Details <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <dl>
            {benefits.map((benefit) => (
              <div key={benefit.key} className="club-rule-row">
                <dt className="text-sm">{benefit.label}</dt>
                <dd className="text-xl font-semibold tabular-nums">
                  {benefit.percent}%{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    off
                  </span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Your highest eligible rates, including active pass benefits.
            Discounts do not add together.
          </p>
        </section>
      )}
      <section className="oura-card p-4">
        <div className="flex items-center gap-3">
          <Dumbbell size={20} className="text-primary" aria-hidden="true" />
          <h2 className="font-semibold">Gym & resort access</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {access.best
            ? `${access.best.plan_snapshot.name} · Until ${membershipDate(access.best.paid_through_date)}, 10 pm Jamaica time.`
            : "Explore gym-only and resort passes, alongside your free Rewards membership."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/member/gym" className="club-button-secondary">
            Your gym
          </Link>
          <Link href="/member/access" className="club-text-link">
            {access.best ? "Manage access" : "Explore passes"}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <Link href="/member/help" className="club-text-link">
        Need help with your membership?{" "}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
