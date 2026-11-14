import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
export const dynamic = "force-dynamic";

type RankRow = {
  member_id: string;
  checkins: number;
  rank: number;
  last_checkin_at: string | null;
};
export default async function StaffRankings({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; page?: string }>;
}) {
  const { admin } = await requireStaff(["admin", "front_desk"]);
  const sp = await searchParams;
  const period = sp.period === "month" ? "month" : "all";
  const page = Math.min(100000, Math.max(0, Math.floor(Number(sp.page) || 0)));
  // Use precisely the same Postgres ranking and Jamaica month boundaries as guests.
  const { data, error } = await admin
    .rpc("member_leaderboard_rankings", { p_period: period })
    .order("rank")
    .range(page * 25, page * 25 + 25);
  const rows = ((data ?? []) as RankRow[]).slice(0, 25);
  const members = rows.length
    ? await admin
        .from("members")
        .select("id,full_name,is_active")
        .in(
          "id",
          rows.map((row) => row.member_id),
        )
    : { data: [], error: null };
  const identities = new Map(
    (members.data ?? []).map((member) => [member.id, member]),
  );
  const failed = error || members.error;
  return (
    <div className="space-y-5">
      <Link href="/checkins" className="club-text-link">
        Back to Club visits
      </Link>
      <header>
        <h1 className="text-2xl font-semibold">Club rankings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Verified property visits, including existing check-in history. One
          visit per day earns 3 points. Rankings use visit totals, with the most
          recent visit breaking ties.
        </p>
      </header>
      <nav aria-label="Ranking period" className="flex gap-3">
        {[
          ["all", "All time"],
          ["month", "This month"],
        ].map(([value, label]) => (
          <Link
            key={value}
            href={`/checkins/rankings?period=${value}`}
            aria-current={period === value ? "page" : undefined}
            className={
              period === value ? "club-button" : "club-button-secondary"
            }
          >
            {label}
          </Link>
        ))}
      </nav>
      {failed ? (
        <p role="alert" className="oura-alert-warning">
          Rankings could not be loaded. Please try again.
        </p>
      ) : !rows.length ? (
        <p>No recorded visits in this period.</p>
      ) : (
        <ol aria-label="Member rankings" className="divide-y divide-border">
          {rows.map((row) => {
            const member = identities.get(row.member_id);
            return (
              <li key={row.member_id}>
                <Link
                  href={`/members/${row.member_id}`}
                  className="flex items-center gap-4 py-4"
                >
                  <span className="w-12 shrink-0 text-xl font-semibold tabular-nums">
                    #{row.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-semibold">
                      {member?.full_name || "Member record"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {member?.is_active === false
                        ? "Inactive membership · "
                        : ""}
                      {row.last_checkin_at
                        ? `Last visit ${new Date(row.last_checkin_at).toLocaleDateString("en-GB", { timeZone: "America/Jamaica", day: "numeric", month: "short", year: "numeric" })}`
                        : "No recent visit"}
                    </p>
                  </div>
                  <span className="shrink-0 text-right">
                    <strong className="text-xl tabular-nums">
                      {row.checkins}
                    </strong>
                    <span className="block text-xs text-muted-foreground">
                      visits
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
      {!failed && (
        <nav aria-label="Ranking pages" className="flex justify-between gap-4">
          {page > 0 && (
            <Link
              href={`/checkins/rankings?period=${period}&page=${page - 1}`}
              className="club-text-link"
            >
              Previous
            </Link>
          )}
          {(data?.length ?? 0) > 25 && (
            <Link
              href={`/checkins/rankings?period=${period}&page=${page + 1}`}
              className="club-text-link"
            >
              Next
            </Link>
          )}
        </nav>
      )}
      <p className="text-xs text-muted-foreground">
        Names and member records are visible here to management staff. The guest
        leaderboard continues to use display aliases.
      </p>
    </div>
  );
}
