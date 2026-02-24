import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BackButton } from "@/components/ui/back-button";
import { getMemberLeaderboardSnapshot, type LeaderboardPeriod, type LeaderboardRow } from "@/lib/member/leaderboard";

export const dynamic = "force-dynamic";

function Avatar({ row }: { row: LeaderboardRow }) {
  return (
    <div
      className={[
        "relative h-11 w-11 shrink-0 rounded-full border flex items-center justify-center text-sm font-semibold shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(0,0,0,0.28)]",
        row.avatar.bgClass,
        row.avatar.borderClass,
        row.avatar.textClass,
      ].join(" ")}
      aria-hidden="true"
    >
      <span className={["absolute right-0.5 top-0.5 h-2 w-2 rounded-full", row.avatar.accentClass].join(" ")} />
      {row.avatar.glyph}
    </div>
  );
}

export default async function MemberLeaderboardPage(props: {
  searchParams?: Promise<{ view?: string; period?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const view = searchParams.view === "top" ? "top" : "near";
  const period: LeaderboardPeriod = searchParams.period === "month" ? "month" : "all";

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

  const snapshot = await getMemberLeaderboardSnapshot({
    supabase: createAdminClient(),
    memberId: String(member.id),
    nearWindow: 5,
    period,
  });

  const rows = view === "top" ? snapshot.topRows : snapshot.nearRows;
  const encouragement =
    snapshot.myRank === 1
      ? "You are leading the board. Keep the momentum."
      : snapshot.myRank && snapshot.myRank <= 5
      ? "You are close to the top. One strong week can move you up."
      : snapshot.myRank
      ? "Good progress. Keep checking in to climb the ranks."
      : "Start checking in to enter the leaderboard.";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leaderboard</h1>
        </div>
        <BackButton fallbackHref="/member" />
      </div>

      <div className="oura-card p-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded border oura-surface-muted p-3">
            <div className="opacity-70">Your rank</div>
            <div className="text-lg font-semibold">
              {snapshot.myRank ? `#${snapshot.myRank}` : "Unranked"}
            </div>
            <div className="text-xs opacity-70">of {snapshot.totalRanked} members</div>
          </div>

          <div className="rounded border oura-surface-muted p-3 text-right">
            <div className="opacity-70">{period === "month" ? "This month" : "All-time"}</div>
            <div className="text-lg font-semibold">{snapshot.myCheckins}</div>
            <div className="text-xs opacity-70">check-ins</div>
          </div>
        </div>

        <div className="mt-2 text-xs opacity-75">
          {snapshot.nextGap && snapshot.myRank
            ? `${encouragement} ${snapshot.nextGap} more check-in${snapshot.nextGap === 1 ? "" : "s"} to catch the next rank.`
            : encouragement}
        </div>

        <div className="mt-3 inline-flex rounded-lg border p-1 text-sm">
          <Link
            href={`/member/leaderboard?period=all&view=${view}`}
            className={[
              "rounded px-3 py-1.5",
              period === "all" ? "oura-surface-muted font-medium" : "opacity-80 hover:opacity-100",
            ].join(" ")}
          >
            All-time
          </Link>
          <Link
            href={`/member/leaderboard?period=month&view=${view}`}
            className={[
              "rounded px-3 py-1.5",
              period === "month" ? "oura-surface-muted font-medium" : "opacity-80 hover:opacity-100",
            ].join(" ")}
          >
            Monthly
          </Link>
        </div>

        <div className="mt-2 inline-flex rounded-lg border p-1 text-sm">
          <Link
            href={`/member/leaderboard?period=${period}&view=near`}
            className={[
              "rounded px-3 py-1.5",
              view === "near" ? "oura-surface-muted font-medium" : "opacity-80 hover:opacity-100",
            ].join(" ")}
          >
            Near me
          </Link>
          <Link
            href={`/member/leaderboard?period=${period}&view=top`}
            className={[
              "rounded px-3 py-1.5",
              view === "top" ? "oura-surface-muted font-medium" : "opacity-80 hover:opacity-100",
            ].join(" ")}
          >
            Top 25
          </Link>
        </div>

        {snapshot.badges.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {snapshot.badges.map((badge) => (
              <span
                key={badge.label}
                className={[
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  badge.tone === "amber"
                    ? "border-amber-300/50 bg-amber-400/10 text-amber-100"
                    : badge.tone === "teal"
                    ? "border-teal-300/50 bg-teal-400/10 text-teal-100"
                    : badge.tone === "rose"
                    ? "border-rose-300/50 bg-rose-400/10 text-rose-100"
                    : badge.tone === "violet"
                    ? "border-violet-300/50 bg-violet-400/10 text-violet-100"
                    : "border-sky-300/50 bg-sky-400/10 text-sky-100",
                ].join(" ")}
              >
                {badge.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="oura-card p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">{view === "top" ? "Top members" : "Your position"}</h2>
          <span className="text-xs opacity-70">Other members shown as Anonymous</span>
        </div>

        {rows.length === 0 ? (
          <div className="mt-3 text-sm opacity-70">No check-ins yet this month.</div>
        ) : (
          <div className="mt-3 space-y-2">
            {rows.map((row) => (
              <div
                key={row.member_id}
                className={[
                  "rounded border p-3",
                  row.isCurrentMember ? "border-cyan-300/50 oura-surface-muted" : "border-white/20",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-[3.5rem] rounded border border-white/20 px-2 py-1 text-center text-xs font-semibold text-white/90">
                      #{row.rank}
                    </div>
                    <Avatar row={row} />
                    <div>
                      <div className="text-sm font-medium">
                        {row.isCurrentMember ? "You" : row.alias}
                      </div>
                      <div className="text-xs opacity-70">{row.isCurrentMember ? "Your account" : "Anonymous member"}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-semibold tabular-nums">{row.checkins}</div>
                    <div className="text-xs opacity-70">{period === "month" ? "this month" : "all-time"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
