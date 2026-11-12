import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Role = "admin" | "front_desk" | "security";
type Status = "pending" | "contacted" | "converted" | "canceled" | "all";

function safeStatus(s: string | undefined): Status {
  const v = (s || "pending").trim();
  return (
    ["pending", "contacted", "converted", "canceled", "all"] as Status[]
  ).includes(v as Status)
    ? (v as Status)
    : "pending";
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");

  const role = staffProfile.role as Role;
  if (role !== "admin" && role !== "front_desk") redirect("/dashboard");

  const q = (sp.q ?? "")
    .trim()
    .slice(0, 120)
    .replace(/[(),%]/g, " ");
  const page = Math.max(0, Math.floor(Number(sp.page) || 0));
  const status = safeStatus(sp.status);

  let query = supabase
    .from("membership_applications")
    .select(
      "id, full_name, phone, email, requested_plan_code, requested_start_date, status, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(page * 50, page * 50 + 49);

  if (status !== "all") query = query.eq("status", status);

  if (q) {
    // PostgREST OR filter
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }

  const { data: apps, error, count } = await query;

  const statusTabs: { key: Status; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "contacted", label: "Contacted" },
    { key: "converted", label: "Converted" },
    { key: "canceled", label: "Canceled" },
    { key: "all", label: "All" },
  ];

  const backTo = `/applications?page=${page}&status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Access requests</h1>
        <p className="text-sm opacity-70">
          Review existing access requests. Free Rewards signup is immediate
          after account verification.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((t) => {
          const active = status === t.key;
          const href = `/applications?status=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return (
            <Link
              key={t.key}
              href={href}
              className={`rounded-full border px-3 py-1 text-xs ${
                active ? "font-semibold" : "opacity-70 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form action="/applications" method="get" className="flex gap-2">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={q}
          className="w-full rounded border px-3 py-2"
          placeholder="Search name, email, or phone…"
        />
        <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Search
        </button>
      </form>

      {error ? (
        <div className="rounded border p-3 text-sm">
          Could not load applications.
          <div className="mt-1 text-xs opacity-70">{error.message}</div>
        </div>
      ) : null}

      {!error && (!apps || apps.length === 0) ? (
        <div className="rounded border p-3 text-sm opacity-70">
          No applications found{q ? " for that search" : ""}.
        </div>
      ) : null}

      <div className="space-y-2">
        {(apps ?? []).map((a) => (
          <Link
            key={a.id}
            href={`/applications/${a.id}?back=${encodeURIComponent(backTo)}`}
            className="block rounded border p-3 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{a.full_name}</div>
                <div className="text-sm opacity-70">
                  {a.email || "(no email)"}
                  {a.phone ? ` • ${a.phone}` : ""}
                </div>
                <div className="text-xs opacity-60">
                  Plan: {a.requested_plan_code}
                  {a.requested_start_date
                    ? ` • Start: ${a.requested_start_date}`
                    : ""}
                </div>
              </div>
              <div className="rounded-full border px-2 py-1 text-xs">
                {a.status}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="flex justify-between gap-3">
        {page > 0 ? (
          <Link
            href={`/applications?${new URLSearchParams({ q, status, page: String(page - 1) })}`}
            className="rounded border p-3"
          >
            Previous
          </Link>
        ) : (
          <span />
        )}
        {(page + 1) * 50 < (count || 0) && (
          <Link
            href={`/applications?${new URLSearchParams({ q, status, page: String(page + 1) })}`}
            className="rounded border p-3"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
