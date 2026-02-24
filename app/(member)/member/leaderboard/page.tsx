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
        "h-10 w-10 shrink-0 rounded-full border flex items-center justify-center text-sm font-semibold",
        row.avatar.bgClass,
        row.avatar.borderClass,
        row.avatar.textClass,
      ].join(" ")}
      aria-hidden="true"
    >
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

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <p className="text-sm opacity-70">Anonymous check-in ranking for {snapshot.periodLabel}.</p>
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
          {snapshot.myRank === 1
            ? period === "month"
              ? "You are currently #1 this month."
              : "You are currently #1 all-time."
            : snapshot.myRank
            ? snapshot.nextGap === 0
              ? "You are tied with the next rank above you."
              : `${snapshot.nextGap} more check-in${snapshot.nextGap === 1 ? "" : "s"} to reach the next rank.`
            : period === "month"
            ? "Check in to appear on this month’s leaderboard."
            : "Check in to appear on the all-time leaderboard."}
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
                    <div className="text-xs opacity-70">check-ins</div>
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
