import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CreditCard } from "lucide-react";
import { requireMember, loadAccess, loadCatalogue } from "@/lib/access/server";
import { firstName } from "@/lib/format/name";
import { facilities } from "@/lib/access/rules";
import { effectiveBenefits } from "@/lib/access/benefits";
import { membershipDate } from "@/lib/format/date";
import { getMemberGymSummary } from "@/lib/member/leaderboard";

export const dynamic = "force-dynamic";
export default async function MemberHome() {
  const { member, admin } = await requireMember();
  const [access, catalogue, summary, pointRows] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(),
    getMemberGymSummary(admin, member.id),
    admin.rpc("club_visit_points", { p_member_id: member.id }),
  ]);
  const points = pointRows.error ? null : Number(pointRows.data ?? 0);
  const benefits = effectiveBenefits(
    catalogue.find((plan) => plan.code === "rewards_free"),
    access.passes,
    member.is_active,
  );
  const included = [
    ...new Set(
      access.current.flatMap((pass) => facilities(pass.plan_snapshot)),
    ),
  ];
  return (
    <div className="space-y-6">
      <header className="club-home-hero">
        <Image
          src="/images/hotel/beach-sunset.webp"
          alt="Sunset over the beach at Travellers Beach Resort"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 640px"
        />
        <div className="club-home-hero-copy">
          <p className="club-eyebrow">Your place by the sea</p>
          <h1>Welcome back, {firstName(member.full_name)}.</h1>
          <p>Make yourself at home.</p>
        </div>
      </header>
      {!member.is_active && (
        <p role="alert" className="oura-alert-warning">
          Please contact the front desk to verify your membership and benefits.
        </p>
      )}
      <section className="club-home-membership" aria-label="Membership summary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="club-eyebrow">Your membership</p>
            <h2 className="mt-1 font-semibold">
              {access.best?.plan_snapshot.name || "Rewards membership"}
            </h2>
          </div>
          <span className={member.is_active ? "club-status" : "text-sm"}>
            {member.is_active ? "Active" : "Needs assistance"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {member.is_active
            ? access.best
              ? `Facility access until ${membershipDate(access.best.paid_through_date)} · 10 pm Jamaica time`
              : "Free Rewards benefits. Facility passes are available separately."
            : "Please speak with the front desk."}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/member/card" className="club-button">
            <CreditCard size={18} aria-hidden="true" /> Show my card
          </Link>
          <Link href="/member/access" className="club-text-link">
            {access.best ? "Manage access" : "Explore passes"}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
      {member.is_active && included.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">
            Included with your membership
          </h2>
          <ul className="club-inclusions">
            {included.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Based on your active passes. Cabana rentals are separate.
          </p>
        </section>
      )}
      <section id="club-visits" className="club-home-visits space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Your Club visits</h2>
          <Link href="/member/check-ins" className="club-text-link">
            History <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <dl className="club-metrics">
          {[
            ["Visits", summary.allTimeCheckins ?? "—"],
            ["Points", points ?? "—"],
            [
              "Club rank",
              summary.rankingAvailable && summary.rank
                ? `#${summary.rank}`
                : "—",
            ],
          ].map(([label, value]) => (
            <div key={label} className="club-metric">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {summary.badges?.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Your achievements">
            {summary.badges.map((badge) => (
              <li
                key={badge.label}
                className="rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-primary"
              >
                {badge.label}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">
          Earn 3 points per visit. Show your card at the front gate or
          restaurant. One visit per day, Jamaica time.
        </p>
        <Link href="/member/leaderboard" className="club-text-link">
          View Club rankings <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
      {member.is_active && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Your benefits today</h2>
            <Link href="/member/benefits" className="club-text-link">
              Details <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <dl className="club-home-benefits">
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
          <p className="mt-2 text-xs text-muted-foreground">
            Your highest eligible rates. Discounts do not add together.
          </p>
        </section>
      )}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Enjoy Travellers</h2>
        <p className="text-sm text-muted-foreground">
          A little inspiration for your next visit. Check your benefits for what
          your membership includes.
        </p>
        <div className="club-hotel-grid">
          {[
            ["pool", "Poolside", "Take a little time to unwind."],
            [
              "restaurant-terrace",
              "By the sea",
              "Enjoy the restaurant and bar.",
            ],
            ["gym", "Stay active", "Make time for your workout."],
            [
              "games-lounge",
              "Family games lounge",
              "Spend some time together.",
            ],
          ].map(([photo, title, caption]) => (
            <article key={photo}>
              <div className="club-hotel-photo">
                <Image
                  src={`/images/hotel/${photo}.webp`}
                  alt={title + " at Travellers Beach Resort"}
                  fill
                  sizes="(max-width: 640px) 45vw, 300px"
                />
              </div>
              <h3 className="mt-2 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
            </article>
          ))}
        </div>
      </section>
      <Link href="/member/help" className="club-text-link">
        Need help with your membership?{" "}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
