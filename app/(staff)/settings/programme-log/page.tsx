import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
export default async function ProgrammeLog({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { admin } = await requireStaff(["admin"]);
  const sp = await searchParams;
  const page = Math.max(0, Math.floor(Number(sp.page) || 0));
  const { data, error, count } = await admin
    .from("club_audit_events")
    .select("id, actor_id, member_id, action, detail, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(page * 50, page * 50 + 49);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Programme audit</h1>
      <p className="text-sm opacity-80">
        Access grants/revocations, recorded benefit uses, member status, and
        programme changes since migration. Automated/service changes may have no
        employee actor.
      </p>
      <Link href="/settings/logs" className="inline-block py-3 underline">
        Payment & gym activity logs
      </Link>
      {error ? (
        <p role="alert">Could not load programme audit.</p>
      ) : (
        data?.map((e) => (
          <div key={e.id} className="rounded border p-3 text-sm">
            <h2 className="font-semibold">{e.action.replaceAll("_", " ")}</h2>
            <p className="mt-2">
              {new Date(e.created_at).toLocaleString("en-US", {
                timeZone: "America/Jamaica",
              })}
            </p>
            <p className="mt-2 break-all">
              Actor: {e.actor_id || "System / service"}
            </p>
            {e.member_id && (
              <Link
                href={`/members/${e.member_id}`}
                className="inline-block py-2 underline"
              >
                Member record
              </Link>
            )}
            <pre className="mt-2 whitespace-pre-wrap break-all text-xs">
              {JSON.stringify(e.detail, null, 2)}
            </pre>
          </div>
        ))
      )}
      <div className="flex justify-between">
        {page > 0 && (
          <Link
            href={`/settings/programme-log?page=${page - 1}`}
            className="rounded border p-3"
          >
            Previous
          </Link>
        )}
        {(page + 1) * 50 < (count || 0) && (
          <Link
            href={`/settings/programme-log?page=${page + 1}`}
            className="rounded border p-3"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
