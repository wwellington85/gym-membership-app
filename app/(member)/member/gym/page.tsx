import Link from "next/link";
import { requireMember, loadAccess } from "@/lib/access/server";
import { getMemberGymSummary } from "@/lib/member/leaderboard";
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
        <p className="text-sm opacity-80">Travellers Club · Gym</p>
        <h1 className="mt-2 text-2xl font-semibold">
          Your gym, {firstName(member.full_name)}
        </h1>
        <p className="mt-2 text-sm opacity-80">
          Your visits, progress, and membership in one place.
        </p>
      </header>
      <section className="oura-card space-y-3 p-4">
        <h2 className="text-lg font-semibold">
          {access === null
            ? "Access needs verification"
            : access.gym
              ? "Gym access active"
              : "No gym access active now"}
        </h2>
        {access?.gym && current ? (
          <p className="text-sm">
            {current.plan_snapshot.name} · Valid through{" "}
            {current.paid_through_date}, 10 pm Jamaica time.
          </p>
        ) : (
          <p className="text-sm opacity-80">
            {!member.is_active
              ? "Please contact the front desk about your membership."
              : access === null
                ? "We could not load your access. Ask the front desk to verify your pass."
                : "Your history and achievements remain available. Explore passes or ask the front desk about access included with your stay."}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/member/card"
            className="rounded border bg-indigo-500/20 px-4 py-3 text-sm font-medium"
          >
            Show my card
          </Link>
          <Link
            href="/member/access?returnTo=/member/gym"
            className="rounded border px-4 py-3 text-sm"
          >
            {access?.gym ? "Manage or renew access" : "Explore access"}
          </Link>
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="gym-progress">
        <h2 id="gym-progress" className="font-semibold">
          Your progress
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Verified visits", summary.allTimeCheckins ?? "Unavailable"],
            ["Day streak", summary.streakDays ?? "Unavailable"],
            [
              "All-time rank",
              !summary.rankingAvailable
                ? "Unavailable"
                : summary.rank
                  ? `#${summary.rank}`
                  : "Unranked",
            ],
          ].map(([label, value]) => (
            <div key={label} className="oura-card min-w-0 p-3">
              <p className="text-xs opacity-80">{label}</p>
              <p className="mt-2 break-words text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <p className="text-sm opacity-80">
          Progress comes from gym visits verified by staff. Your history stays
          with you when a pass ends.
        </p>
        {summary.badges.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Your achievements">
            {summary.badges.map((badge) => (
              <li
                key={badge.label}
                className="rounded-full border border-indigo-300/40 bg-indigo-500/15 px-3 py-2 text-sm"
              >
                {badge.label}
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/member/leaderboard"
          className="inline-block rounded border px-4 py-3 text-sm"
        >
          View gym rankings
        </Link>
      </section>
      <section className="oura-card space-y-3 p-4">
        <h2 className="font-semibold">Recent gym visits</h2>
        {summary.recentVisits === null ? (
          <p role="status" className="text-sm">
            Visit history is temporarily unavailable. Please try again.
          </p>
        ) : !summary.recentVisits.length ? (
          <p className="text-sm opacity-80">
            No visits recorded yet. Show your card to staff when you visit.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
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
        <Link
          href="/member/check-ins"
          className="inline-block rounded border px-4 py-3 text-sm"
        >
          View visit history
        </Link>
      </section>
      <p className="text-sm opacity-80">
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
