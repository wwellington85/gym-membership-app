import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { addDaysYmd, jamaicaTodayYmd } from "@/lib/membership/status";
export const dynamic = "force-dynamic";
export default async function CheckinsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; page?: string; err?: string }>;
}) {
  const { admin } = await requireStaff();
  const sp = await searchParams;
  const days = [1, 7, 30, 90].includes(Number(sp.range)) ? Number(sp.range) : 1;
  const page = Math.max(0, Math.floor(Number(sp.page) || 0));
  const today = jamaicaTodayYmd();
  const from = `${addDaysYmd(today, -(days - 1))}T00:00:00-05:00`;
  const to = `${addDaysYmd(today, 1)}T00:00:00-05:00`;
  const {
    data: rows,
    error,
    count,
  } = await admin
    .from("checkins")
    .select("id, member_id, checked_in_at, points_earned, members(full_name)", {
      count: "exact",
    })
    .gte("checked_in_at", from)
    .lt("checked_in_at", to)
    .order("checked_in_at", { ascending: false })
    .range(page * 50, page * 50 + 49);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-xl font-semibold">Gym visits</h1>
        <Link href="/checkins/scan" className="rounded border p-3">
          Verify / record visit
        </Link>
      </div>
      <p className="text-sm opacity-80">
        Verified gym activity. A member lookup or discount check does not create
        a visit.
      </p>
      <nav className="flex flex-wrap gap-2" aria-label="Visit period">
        {[1, 7, 30, 90].map((n) => (
          <Link
            key={n}
            aria-current={n === days ? "page" : undefined}
            href={`/checkins?range=${n}`}
            className="rounded border p-3 text-sm"
          >
            {n === 1 ? "Today" : `Last ${n} days`}
          </Link>
        ))}
      </nav>
      {(error || sp.err) && (
        <p role="alert" className="oura-alert-danger">
          {sp.err || "Could not load visits. Please try again."}
        </p>
      )}
      {!error && !rows?.length && <p>No visits in this period.</p>}
      <div className="space-y-2">
        {rows?.map((r: any) => (
          <Link
            key={r.id}
            href={`/members/${r.member_id}`}
            className="block rounded border p-3"
          >
            <h2 className="font-medium">{r.members?.full_name || "Member"}</h2>
            <p className="mt-2 text-sm opacity-80">
              {new Date(r.checked_in_at).toLocaleString("en-US", {
                timeZone: "America/Jamaica",
              })}{" "}
              · {r.points_earned ?? 0} activity points
            </p>
          </Link>
        ))}
      </div>
      <div className="flex justify-between">
        {page > 0 ? (
          <Link
            className="rounded border p-3"
            href={`/checkins?range=${days}&page=${page - 1}`}
          >
            Previous
          </Link>
        ) : (
          <span />
        )}
        {(page + 1) * 50 < (count || 0) && (
          <Link
            className="rounded border p-3"
            href={`/checkins?range=${days}&page=${page + 1}`}
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
