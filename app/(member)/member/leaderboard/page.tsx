import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";
import { getMemberLeaderboardSnapshot, type LeaderboardRow } from "@/lib/member/leaderboard";

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
  searchParams?: Promise<{ view?: string }>;
}) {
  const searchParams = (await props.searchParams) ?? {};
  const view = searchParams.view === "top" ? "top" : "near";

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
    supabase,
    memberId: String(member.id),
    nearWindow: 5,
  });

  const rows = view === "top" ? snapshot.topRows : snapshot.nearRows;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leaderboard</h1>
          <p className="text-sm opacity-70">Anonymous check-in ranking for {snapshot.monthLabel}.</p>
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
            <div className="opacity-70">This month</div>
            <div className="text-lg font-semibold">{snapshot.myCheckins}</div>
            <div className="text-xs opacity-70">check-ins</div>
          </div>
        </div>

        <div className="mt-2 text-xs opacity-75">
          {snapshot.myRank === 1
            ? "You are currently #1 this month."
            : snapshot.myRank
            ? snapshot.nextGap === 0
              ? "You are tied with the next rank above you."
              : `${snapshot.nextGap} more check-in${snapshot.nextGap === 1 ? "" : "s"} to reach the next rank.`
            : "Check in to appear on this month’s leaderboard."}
        </div>

        <div className="mt-3 inline-flex rounded-lg border p-1 text-sm">
          <Link
            href="/member/leaderboard?view=near"
            className={[
              "rounded px-3 py-1.5",
              view === "near" ? "oura-surface-muted font-medium" : "opacity-80 hover:opacity-100",
            ].join(" ")}
          >
            Near me
          </Link>
          <Link
            href="/member/leaderboard?view=top"
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
          <span className="text-xs opacity-70">Names hidden for privacy</span>
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
                    <Avatar row={row} />
                    <div>
                      <div className="text-sm font-medium">
                        {row.isCurrentMember ? "You" : row.alias}
                      </div>
                      <div className="text-xs opacity-70">Rank #{row.rank}</div>
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
