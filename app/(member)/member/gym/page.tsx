import Link from "next/link";
import { requireMember, loadAccess } from "@/lib/access/server";
import { getMemberGymSummary } from "@/lib/member/leaderboard";
import { membershipDate } from "@/lib/format/date";
import { firstName } from "@/lib/format/name";

export const dynamic = "force-dynamic";
export default async function GymPage() {
  const { member, admin } = await requireMember();
  const [access, summary] = await Promise.all([
    loadAccess(member.id, member.is_active).catch(() => null),
    getMemberGymSummary(admin, member.id),
  ]);
  const current = access?.current[0];
  return (
    <div className="space-y-5">
      <header>
        <p className="club-eyebrow">YOUR PROGRESS</p>
        <h1 className="mt-2 text-2xl font-semibold">
          Your gym, {firstName(member.full_name)}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your visits, progress, and membership in one place.
        </p>
      </header>
      <section className="space-y-3">
        <h2
          className={`inline-flex text-sm font-medium ${access?.gym ? "club-status" : "club-status club-status-warning"}`}
        >
          {access === null
            ? "Access needs verification"
            : access.gym
              ? "Gym access active"
              : "No gym access active now"}
        </h2>
        {access?.gym && current ? (
          <p className="text-sm">
            {current.plan_snapshot.name} · Valid through{" "}
            {membershipDate(current.paid_through_date)}, 10 pm Jamaica time.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {!member.is_active
              ? "Please contact the front desk about your membership."
              : access === null
                ? "We could not load your access. Ask the front desk to verify your pass."
                : "Your history and achievements remain available. Explore passes or ask the front desk about access included with your stay."}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href="/member/card" className="club-button">
            Show my card
          </Link>
          <Link
            href="/member/access?returnTo=/member/gym"
            className="club-button-secondary"
          >
            {access?.gym ? "Manage or renew access" : "Explore access"}
          </Link>
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="gym-progress">
        <h2 id="gym-progress" className="font-semibold">
          Your progress
        </h2>
        <dl className="club-metrics">
          {[
            ["Visits", summary.allTimeCheckins ?? "—"],
            ["Day streak", summary.streakDays ?? "—"],
            [
              "All-time rank",
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
        {!summary.rankingAvailable && (
          <p role="status" className="text-sm text-muted-foreground">
            Rank is temporarily unavailable. Your recorded visits are unchanged.
          </p>
        )}
        {summary.rankingAvailable && !summary.rank && (
          <p className="text-sm text-muted-foreground">
            Your first verified visit will place you in the rankings.
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Progress comes from gym visits verified by staff. Your history stays
          with you when a pass ends.
        </p>
        {summary.badges.length > 0 && (
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
        <Link href="/member/leaderboard" className="club-text-link">
          View gym rankings
        </Link>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Recent gym visits</h2>
        {summary.recentVisits === null ? (
          <p role="status" className="text-sm">
            Visit history is temporarily unavailable. Please try again.
          </p>
        ) : !summary.recentVisits.length ? (
          <p className="text-sm text-muted-foreground">
            No visits recorded yet. Show your card to staff when you visit.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {summary.recentVisits.map((visit) => (
              <li key={visit.checked_in_at} className="py-3 text-sm">
                {new Date(visit.checked_in_at).toLocaleString("en-US", {
                  timeZone: "America/Jamaica",
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </li>
            ))}
          </ul>
        )}
        <Link href="/member/check-ins" className="club-text-link">
          View visit history
        </Link>
      </section>
      <p className="text-sm text-muted-foreground">
        Your gym access sits alongside your Rewards membership.{" "}
        <Link href="/member/benefits" className="underline">
          Explore your hotel benefits
        </Link>{" "}
        or{" "}
        <Link href="/member/settings#starting-screen" className="underline">
          choose your starting screen
        </Link>
        .
      </p>
    </div>
  );
}
