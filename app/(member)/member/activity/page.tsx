import Link from "next/link";
import { requireMember } from "@/lib/access/server";
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { admin, member } = await requireMember();
  const sp = await searchParams;
  const page = Math.max(0, Math.floor(Number(sp.page) || 0));
  const { data, error, count } = await admin
    .from("benefit_uses")
    .select("id, outlet, discount_percent, created_at", { count: "exact" })
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .range(page * 25, page * 25 + 24);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Benefit activity</h1>
      <p className="text-sm text-muted-foreground">
        Uses recorded by staff. This is not a billing statement.
      </p>
      {error ? (
        <p role="alert">We could not load benefit activity.</p>
      ) : !data?.length ? (
        <p>No recorded uses on this page.</p>
      ) : (
        data.map((u) => (
          <div key={u.id} className="rounded border p-3">
            <p className="capitalize">
              {u.outlet} · {u.discount_percent}% benefit
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {new Date(u.created_at).toLocaleString("en-US", {
                timeZone: "America/Jamaica",
              })}
            </p>
          </div>
        ))
      )}
      <div className="flex justify-between">
        {page > 0 && (
          <Link
            href={`/member/activity?page=${page - 1}`}
            className="rounded border p-3"
          >
            Previous
          </Link>
        )}
        {(page + 1) * 25 < (count || 0) && (
          <Link
            href={`/member/activity?page=${page + 1}`}
            className="rounded border p-3"
          >
            Next
          </Link>
        )}
      </div>
      <Link href="/member/help" className="inline-block py-3 underline">
        Report a discrepancy
      </Link>
    </div>
  );
}
