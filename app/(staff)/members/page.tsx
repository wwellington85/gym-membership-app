export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type Filter =
  | "all"
  | "active"
  | "due_soon"
  | "past_due"
  | "needs_contact"
  | "past_due_needs_contact";

function badge(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return "Active";
  if (s === "due_soon") return "Due Soon";
  if (s === "past_due") return "Past Due";
  return status ?? "—";
}

function statusTone(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return "border-emerald-200 bg-emerald-50";
  if (s === "due_soon") return "border-amber-200 bg-amber-50";
  if (s === "past_due") return "border-red-200 bg-red-50";
  return "border";
}

export default async function MembersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    filter?: Filter;
    done?: string;
    mid?: string;
    confirm?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/login");

  const role = staffProfile.role as string;
  const isSecurity = role === "security";

  const q = (sp.q ?? "").trim();
  const filter = (sp.filter ?? "all") as Filter;

  const done = sp.done ?? ""; // "saved" | "already" | ""
  const mid = (sp.mid ?? "").trim();
  const confirm = sp.confirm ?? ""; // "1" | ""

  // Base query (includes membership summary)
  const base = supabase
    .from("members")
    .select(
      "id, full_name, phone, email, created_at, memberships(id, status, paid_through_date, needs_contact, membership_plans(name))"
    )
    .order("created_at", { ascending: false })
    .limit(isSecurity ? 20 : 50);

  const query = q
    ? base.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    : base;

  const { data, error } = await query;

  const members = (data ?? []).map((m: any) => ({
    ...m,
    membership: Array.isArray(m.memberships) ? m.memberships[0] : m.memberships,
  }));

  // Filtering (only used for Admin/Front Desk view)
  const filtered = members.filter((m: any) => {
    const ms = m.membership;
    if (filter === "all") return true;
    if (filter === "active") return ms?.status === "active";
    if (filter === "due_soon") return ms?.status === "due_soon";
    if (filter === "past_due") return ms?.status === "past_due";
    if (filter === "needs_contact") return !!ms?.needs_contact;
    if (filter === "past_due_needs_contact")
      return ms?.status === "past_due" && !!ms?.needs_contact;
    return true;
  });

  // For Security gate mode: use first match as the "Gate Status" member
  const gateMember = isSecurity && q && members.length > 0 ? members[0] : null;
  const gateMembership = gateMember?.membership;

  const isPastDueGate = (gateMembership?.status ?? "") === "past_due";
  const isConfirmingThisMember = !!gateMember && confirm === "1" && mid === gateMember.id;

  // SECURITY: inline check-in (server action)
  async function checkInGate(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const member_id = String(formData.get("member_id") || "").trim();
    const q = String(formData.get("q") || "").trim();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    // Read points setting (default 1)
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("int_value")
      .eq("key", "points_per_checkin")
      .maybeSingle();

    const pointsEarned = settingRow?.int_value ?? 1;

    const { error } = await supabase.from("checkins").insert({
      member_id,
      staff_user_id: user.id,
      points_earned: pointsEarned,
    });

    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    qs.set("mid", member_id);

    if (error) {
      // 23505 = unique violation (already checked in today)
      if ((error as any).code === "23505") {
        qs.set("done", "already");
        redirect(`/members?${qs.toString()}`);
      }
      throw new Error(`Check-in failed: ${error.message}`);
    }

    qs.set("done", "saved");
    redirect(`/members?${qs.toString()}`);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "due_soon", label: "Due Soon" },
    { key: "past_due", label: "Past Due" },
    { key: "needs_contact", label: "Needs Contact" },
  ];

  // -------------------------
  // SECURITY QUICK LOOKUP UI
  // -------------------------
  if (isSecurity) {
    const showBanner = !!done && !!mid && gateMember?.id === mid;

    const qParamsBase = new URLSearchParams();
    if (q) qParamsBase.set("q", q);

    const confirmParams = new URLSearchParams(qParamsBase.toString());
    if (gateMember?.id) confirmParams.set("mid", gateMember.id);
    confirmParams.set("confirm", "1");

    const cancelParams = new URLSearchParams(qParamsBase.toString());

    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Quick Lookup</h1>
          <p className="text-sm opacity-70">
            Search by name or phone to confirm membership at the gate
          </p>
        </div>

        {showBanner && done === "saved" ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
            <div className="font-medium">Checked in</div>
            <div className="mt-1 opacity-80">Visit recorded successfully.</div>
          </div>
        ) : null}

        {showBanner && done === "already" ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="font-medium">Already checked in</div>
            <div className="mt-1 opacity-80">This member already checked in today.</div>
          </div>
        ) : null}

        <form className="rounded border p-3 space-y-2" action="/members" method="get">
          <div className="text-sm font-medium">Search member</div>
          <input
            name="q"
            defaultValue={q}
            className="w-full rounded border px-3 py-3 text-base"
            placeholder="Type name or phone…"
            autoFocus
          />
          <button className="w-full rounded border px-3 py-3 text-sm hover:bg-gray-50">
            Search
          </button>
          <div className="text-xs opacity-60">
            Tip: Try last name or last 4 digits of phone.
          </div>
        </form>

        {error ? (
          <div className="rounded border p-3 text-sm">
            Could not load members.
            <div className="mt-1 text-xs opacity-70">{error.message}</div>
          </div>
        ) : null}

        {!q ? (
          <div className="rounded border p-3 text-sm opacity-70">
            Enter a name or phone number to begin.
          </div>
        ) : null}

        {q && members.length === 0 && !error ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
            <div className="font-medium">No match found</div>
            <div className="mt-1 opacity-80">
              Ask the guest for another phone number or check spelling.
            </div>
          </div>
        ) : null}

        {gateMember ? (
          <div className={`rounded border p-3 ${statusTone(gateMembership?.status)}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs opacity-70">Gate Status</div>
                <div className="text-lg font-semibold">{gateMember.full_name}</div>
                <div className="text-sm opacity-70">{gateMember.phone}</div>

                <div className="mt-2 text-sm">
                  Status:{" "}
                  <span className="font-semibold">{badge(gateMembership?.status)}</span>
                </div>
                <div className="text-sm opacity-70">
                  Paid-through: {gateMembership?.paid_through_date ?? "—"}
                </div>
                <div className="text-xs opacity-70 mt-1">
                  Plan: {gateMembership?.membership_plans?.name ?? "—"}
                </div>

                {isPastDueGate && isConfirmingThisMember ? (
                  <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm">
                    <div className="font-medium">Confirm check-in</div>
                    <div className="mt-1 opacity-80">
                      This membership is <b>Past Due</b>. Confirm with Front Desk before allowing access.
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 items-end">
                <Link
                  href={`/members/${gateMember.id}`}
                  className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                >
                  Open
                </Link>

                {/* Check-in button with confirmation for Past Due */}
                {isPastDueGate ? (
                  isConfirmingThisMember ? (
                    <>
                      <form action={checkInGate}>
                        <input type="hidden" name="member_id" value={gateMember.id} />
                        <input type="hidden" name="q" value={q} />
                        <button className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50">
                          Proceed check-in
                        </button>
                      </form>

                      <Link
                        href={`/members?${cancelParams.toString()}`}
                        className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        Cancel
                      </Link>
                    </>
                  ) : (
                    <Link
                      href={`/members?${confirmParams.toString()}`}
                      className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      Confirm check-in
                    </Link>
                  )
                ) : (
                  <form action={checkInGate}>
                    <input type="hidden" name="member_id" value={gateMember.id} />
                    <input type="hidden" name="q" value={q} />
                    <button className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50">
                      Check in now
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Other matches */}
        {q && members.length > 1 ? (
          <div className="rounded border p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">Other matches</div>
              <div className="text-xs opacity-70">{members.length - 1}</div>
            </div>

            <div className="mt-2 space-y-2">
              {members.slice(1, 6).map((m: any) => (
                <Link
                  key={m.id}
                  href={`/members/${m.id}`}
                  className="block rounded border p-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-sm opacity-70">{m.phone}</div>
                    </div>
                    <div className="text-right text-xs opacity-70">
                      <div>{badge(m.membership?.status)}</div>
                      <div>{m.membership?.paid_through_date ?? ""}</div>
                    </div>
                  </div>
                </Link>
              ))}
              {members.length > 6 ? (
                <div className="text-xs opacity-60">
                  Showing first 5 additional matches.
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // -------------------------
  // ADMIN / FRONT DESK UI
  // -------------------------
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-sm opacity-70">Search and manage gym members</p>
        </div>

        <Link
          href="/members/new"
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          + Add Member
        </Link>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f.key === filter;
          const qs = new URLSearchParams();
          if (q) qs.set("q", q);
          if (f.key !== "all") qs.set("filter", f.key);
          const href = `/members${qs.toString() ? `?${qs.toString()}` : ""}`;
          return (
            <Link
              key={f.key}
              href={href}
              className={`rounded border px-3 py-1.5 text-xs ${
                active ? "font-semibold" : "opacity-70 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {/* Search */}
      <form className="flex gap-2" action="/members" method="get">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={q}
          className="w-full rounded border px-3 py-2"
          placeholder="Search name or phone…"
        />
        <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Search
        </button>
      </form>

      {/* Errors */}
      {error ? (
        <div className="rounded border p-3 text-sm">
          Could not load members.
          <div className="mt-1 text-xs opacity-70">{error.message}</div>
        </div>
      ) : null}

      {/* Empty */}
      {!error && filtered.length === 0 ? (
        <div className="rounded border p-3 text-sm opacity-70">
          No members found{q ? " for that search" : ""}.
          <div className="mt-1">
            <Link href="/members/new" className="underline underline-offset-2">
              Add your first member
            </Link>
          </div>
        </div>
      ) : null}

      {/* List */}
      <div className="space-y-2">
        {filtered.map((m: any) => (
          <Link
            key={m.id}
            href={`/members/${m.id}`}
            className="block rounded border p-3 hover:bg-gray-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{m.full_name}</div>
                <div className="text-sm opacity-70">{m.phone}</div>
                {m.email ? <div className="text-xs opacity-60">{m.email}</div> : null}
              </div>
              <div className="text-right text-xs opacity-70">
                <div>{badge(m.membership?.status)}</div>
                <div>{m.membership?.paid_through_date ?? ""}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
