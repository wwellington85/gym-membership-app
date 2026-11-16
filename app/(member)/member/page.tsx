import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CreditCard, Utensils, CalendarDays } from "lucide-react";
import { requireMember, loadAccess, loadCatalogue } from "@/lib/access/server";
import { firstName } from "@/lib/format/name";
import {
  upcomingPass,
  membershipCardPass,
  availableUpgradePlans,
  accessScope,
} from "@/lib/access/rules";
import { effectiveBenefits } from "@/lib/access/benefits";
import { membershipDate } from "@/lib/format/date";
import { getMemberGymSummary } from "@/lib/member/leaderboard";
import { loadHomeUpdates } from "@/lib/member/home-updates";
import { HomeUpdates } from "@/components/member/home-updates";

export const dynamic = "force-dynamic";
export default async function MemberHome() {
  const { member, admin } = await requireMember();
  const [access, catalogue, summary, pointRows, updates] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(),
    getMemberGymSummary(admin, member.id),
    admin.rpc("club_visit_points", { p_member_id: member.id }),
    member.is_active
      ? loadHomeUpdates(admin, member.id)
      : Promise.resolve({ booking: null, reward: null, error: false }),
  ]);
  const scheduled = member.is_active ? upcomingPass(access.passes) : null;
  const current = membershipCardPass(access.current);
  const points = pointRows.error ? null : Number(pointRows.data ?? 0);
  const benefits = effectiveBenefits(
    catalogue.find((p) => p.code === "rewards_free"),
    access.passes,
    member.is_active,
    new Date(),
    member.local_rewards,
  );
  const restaurant = benefits.find(
    (b) => b.key === "discount_food" && b.percent > 0,
  );
  const plans = availableUpgradePlans(
    catalogue,
    access.passes,
    member.is_active,
  );
  return (
    <div className="space-y-6" data-club-home-ready>
      <header className="club-home-hero">
        <Image
          src="/images/hotel/beach-sunset.webp"
          alt="Sunset over the beach at Travellers Beach Resort"
          fill
          priority
          sizes="(max-width:640px) 100vw, 640px"
        />
        <div className="club-home-hero-copy">
          <p className="club-eyebrow">Your place by the sea</p>
          <h1>Welcome back, {firstName(member.full_name)}.</h1>
        </div>
      </header>
      <section className="club-home-membership" aria-label="Membership summary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="club-eyebrow">Your membership</p>
            <h2 className="mt-1 text-lg font-semibold">
              {current?.plan_snapshot.name ||
                (member.local_rewards ? "Local Rewards" : "Free account")}
            </h2>
          </div>
          <span className={member.is_active ? "club-status" : "text-sm"}>
            {member.is_active ? "Active" : "Needs assistance"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {!member.is_active
            ? "Please contact the front desk to reactivate your membership."
            : current
              ? `${accessScope(current.plan_snapshot) === "resort" ? "Gym & resort" : "Gym"} access until ${membershipDate(current.paid_through_date)}.`
              : scheduled
                ? `Your ${scheduled.plan_snapshot.name} starts on ${membershipDate(scheduled.start_date)}.`
                : member.local_rewards
                  ? "Your Local Rewards benefits are ready to use."
                  : "Earn points when you visit."}
        </p>
        {member.is_active && restaurant && (
          <p className="text-sm text-muted-foreground">
            Restaurant & bar: {restaurant.percent}% off
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/member/card" className="club-button">
            <CreditCard size={18} aria-hidden="true" />
            Show my card
          </Link>
          <Link href="/member/benefits" className="club-text-link text-sm">
            View benefits <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      <nav className="club-home-shortcuts" aria-label="Plan your visit">
        <Link href="/member/dining">
          <Utensils size={19} aria-hidden="true" />
          <span>Restaurant menus</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <Link href="/member/bookings">
          <CalendarDays size={19} aria-hidden="true" />
          <span>My bookings</span>
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </nav>
      <HomeUpdates {...updates} />
      <section className="space-y-3" aria-labelledby="experiences-heading">
        <h2 id="experiences-heading" className="text-lg font-semibold">
          Book an experience
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              href: "/member/experiences?kind=cabana",
              image: "cabanas",
              title: "Cabana rentals",
              subtitle: "Four hours by the pool",
            },
            {
              href: "/member/experiences?kind=dinner",
              image: "starlight",
              title: "Starlight Dinner",
              subtitle: "Private beach dinner for two",
            },
          ].map((e) => (
            <Link
              key={e.image}
              href={e.href}
              className="flex min-w-0 flex-col overflow-hidden rounded-2xl border"
            >
              <div className="relative h-28 sm:h-36">
                <Image
                  src={`/images/experiences/${e.image}.webp`}
                  alt=""
                  fill
                  sizes="(max-width:640px) 45vw, 300px"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <h3 className="text-sm font-semibold">{e.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {e.subtitle}
                </p>
                <span className="mt-auto pt-2 text-xs font-medium text-primary">
                  View availability →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section id="club-visits" className="club-home-visits space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your Club progress</h2>
          <Link href="/member/check-ins" className="club-text-link text-sm">
            Visit history <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <dl className="club-home-progress">
          {[
            ["Visits", summary.allTimeCheckins ?? "—"],
            ["Points earned", points ?? "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          {member.is_active
            ? "3 points per verified visit · One visit per day."
            : "Your past visits and earned points stay with your account."}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          <Link
            href="/member/benefits#member-rewards"
            className="club-text-link text-sm"
          >
            View your rewards <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/member/leaderboard" className="club-text-link text-sm">
            Club rankings <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      {plans.length > 0 && (
        <section className="club-home-pass-offer">
          <div>
            <h2 className="font-semibold">Explore Club passes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {plans.length > 1
                ? "Weekly or monthly gym & resort access, with enhanced discounts."
                : `${plans[0]?.code === "club_weekly" ? "Weekly" : "Monthly"} gym & resort access, with enhanced discounts.`}
            </p>
          </div>
          <Link
            href="/member/access#explore-passes"
            className="club-text-link text-sm"
          >
            Compare{" "}
            {plans.length > 1
              ? "plans"
              : plans[0]?.code === "club_weekly"
                ? "weekly access"
                : "monthly access"}{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}
      <Link href="/member/help" className="club-text-link text-sm">
        Membership help <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
