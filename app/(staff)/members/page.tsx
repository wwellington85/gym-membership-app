import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
export const dynamic = "force-dynamic";
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    filter?: string;
    page?: string;
    access?: string;
  }>;
}) {
  const { admin, staff } = await requireStaff();
  const sp = await searchParams;
  const query = String(sp.q || "")
    .trim()
    .slice(0, 120);
  const allowed = [
    "all",
    "access",
    "rewards",
    "due_soon",
    "inactive",
    "all_records",
  ];
  const requested =
    sp.access === "1"
      ? "access"
      : sp.access === "0"
        ? "rewards"
        : sp.filter || "all";
  const filter =
    allowed.includes(requested) &&
    (staff.role === "admin" || !["inactive", "all_records"].includes(requested))
      ? requested
      : "all";
  const page = Math.min(100000, Math.max(0, Math.floor(Number(sp.page) || 0)));
  const size = 25;
  const { data: rows, error } = await admin.rpc("search_club_members", {
    p_query: query,
    p_filter: filter,
    p_page: page,
    p_size: size,
  });
  const total = Number(rows?.[0]?.total ?? 0);
  const href = (overrides: Record<string, string>) =>
    `/members?${new URLSearchParams({ q: query, filter, ...overrides }).toString()}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          {staff.role === "security" ? "Member lookup" : "Members"}
        </h1>
        {staff.role !== "security" && (
          <Link className="rounded border p-3 text-sm" href="/members/new">
            Add member
          </Link>
        )}
      </div>
      <form action="/members" className="space-y-2">
        <label htmlFor="member-search" className="text-sm">
          Name, phone, email or full membership number
        </label>
        <div className="flex gap-2">
          <input
            id="member-search"
            name="q"
            defaultValue={query}
            className="oura-input min-w-0 flex-1 p-3"
            maxLength={120}
          />
          <input type="hidden" name="filter" value={filter} />
          <button className="rounded border p-3">Search</button>
        </div>
      </form>
      <nav aria-label="Member filters" className="flex flex-wrap gap-2">
        {[
          ["all", "Active members"],
          ["access", "Valid access"],
          ["rewards", "Rewards only"],
          ["due_soon", "Access ends soon"],
          ...(staff.role === "admin"
            ? [
                ["inactive", "Inactive"],
                ["all_records", "All records"],
              ]
            : []),
        ].map(([value, label]) => (
          <Link
            key={value}
            href={href({ filter: value, page: "0" })}
            aria-current={value === filter ? "page" : undefined}
            className={`rounded border px-3 py-3 text-sm ${value === filter ? "bg-indigo-500/20 font-semibold" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {error ? (
        <p role="alert" className="oura-alert-danger">
          Member search is unavailable. Please try again.
        </p>
      ) : (
        <>
          <p className="text-sm opacity-80">
            {total
              ? `${total} matching members`
              : page > 0
                ? "No members on this page. Return to the previous page."
                : "No matching members. Try another name or membership number."}{" "}
            Select the correct person before taking action.
          </p>
          <div className="space-y-2">
            {rows?.map(
              (m: {
                id: string;
                full_name: string;
                phone: string;
                email: string;
                scope: string;
                is_active: boolean;
                valid_through: string;
              }) => (
                <Link
                  key={m.id}
                  href={
                    staff.role === "security"
                      ? `/checkins/scan?member=${m.id}`
                      : `/members/${m.id}`
                  }
                  className="block rounded border p-4"
                >
                  <h2 className="font-semibold">{m.full_name}</h2>
                  <p className="mt-2 text-sm opacity-80">
                    {staff.role === "security"
                      ? m.phone
                        ? `Phone ending ${m.phone.slice(-4)}`
                        : "Verify membership number"
                      : [m.phone, m.email].filter(Boolean).join(" · ")}
                  </p>
                  <p className="mt-2 text-sm">
                    {!m.is_active
                      ? "Inactive"
                      : m.scope === "resort"
                        ? "Gym & resort access"
                        : m.scope === "gym"
                          ? "Gym only"
                          : "Rewards benefits · No paid facility access"}
                    {m.valid_through ? ` · Through ${m.valid_through}` : ""}
                  </p>
                </Link>
              ),
            )}
          </div>
          <div className="flex justify-between gap-3">
            {page > 0 ? (
              <Link
                href={href({ page: String(page - 1) })}
                className="rounded border p-3"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            {(page + 1) * size < total && (
              <Link
                href={href({ page: String(page + 1) })}
                className="rounded border p-3"
              >
                Next
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
