export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAccessActiveAtJamaicaCutoff } from "@/lib/membership/status";
import { redirect } from "next/navigation";


function getMemberPlan(m: any): any {
  const plan =
    m?.membership?.membership_plans ??
    m?.memberships?.membership_plans ??
    m?.membership_plans ??
    m?.plan ??
    null;

  if (Array.isArray(plan)) return plan[0] ?? null;
  return plan ?? null;
}


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

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");

  const role = staffProfile.role as string;
  const isSecurity = role === "security";
  const admin = createAdminClient();

  const q = (sp.q ?? "").trim();
  const filter = (sp.filter ?? "all") as Filter;

  const done = sp.done ?? ""; // "saved" | "already" | "inactive" | ""
  const mid = (sp.mid ?? "").trim();
  const confirm = sp.confirm ?? ""; // "1" | ""

  // Base query: members first, then fetch membership snapshot separately.
  const base = admin
    .from("members")
    .select(
      "id, full_name, phone, email, is_active, created_at"
    )
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(isSecurity ? 20 : 50);

  // Query-param filters (from dashboard tiles)
  const qStatus = ((sp as any).status ?? "").toString().toLowerCase();
  const qAccess = ((sp as any).access ?? "").toString(); // "1" | "0" | ""
  const qNeeds = ((sp as any).needs_contact ?? "").toString(); // "1" | "true" | ""

  const query = q
    ? base.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    : base;

  const { data: memberRows, error } = await query;
  const memberIds = (memberRows ?? []).map((m: any) => m.id).filter(Boolean);

  const { data: membershipRows, error: membershipError } = memberIds.length
    ? await admin
        .from("memberships")
        .select(
          "id, member_id, status, paid_through_date, needs_contact, start_date, membership_plans(name, code, price, plan_type, duration_days, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa)"
        )
        .in("member_id", memberIds)
        .order("start_date", { ascending: false })
    : { data: [] as any[], error: null };

  const membershipByMemberId = new Map<string, any>();
  (membershipRows ?? []).forEach((row: any) => {
    const key = String(row.member_id);
    if (!membershipByMemberId.has(key)) membershipByMemberId.set(key, row);
  });

  const members = (memberRows ?? []).map((m: any) => ({
    ...m,
    membership: membershipByMemberId.get(String(m.id)) ?? null,
  }));

  // Filtering (only used for Admin/Front Desk view)
  let filtered = members.filter((m: any) => {
    const ms = m.membership;
    const planRaw: any = ms?.membership_plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    const activeNow = isAccessActiveAtJamaicaCutoff({
      status: ms?.status ?? null,
      startDate: ms?.start_date ?? null,
      paidThroughDate: ms?.paid_through_date ?? null,
      durationDays: plan?.duration_days ?? null,
    });
    if (filter === "all") return true;
    if (filter === "active") return activeNow;
    if (filter === "due_soon") return ms?.status === "due_soon";
    if (filter === "past_due") return ms?.status === "past_due";
    if (filter === "needs_contact") return !!ms?.needs_contact;
    if (filter === "past_due_needs_contact")
      return ms?.status === "past_due" && !!ms?.needs_contact;
    return true;
  });

  

  // Apply query-param filters (dashboard tiles) on top of the tab filter
  if (qStatus) {
    filtered = (filtered ?? []).filter((m: any) => {
      const status =
        (m.membership?.status ??
          m.memberships?.status ??
          m.membership_status ??
          m.status ??
          "") as any;
      return String(status).toLowerCase() === qStatus;
    });
  }

  if (qNeeds && (qNeeds === "1" || qNeeds === "true")) {
    filtered = (filtered ?? []).filter((m: any) => !!m.membership?.needs_contact);
  }
  if (qAccess === "1" || qAccess === "0") {
    const want = qAccess === "1";
    filtered = (filtered ?? []).filter((m: any) => {
      const plan = getMemberPlan(m);
      const code = String(plan?.code ?? "").toLowerCase();
      const price = Number(plan?.price ?? 0);

      // Prefer explicit column if/when it exists
      const explicit = (plan as any)?.grants_access;
      const grants =
        typeof explicit === "boolean" ? explicit : (!code.includes("rewards") && (code.startsWith("club_") || price > 0));

      return !!grants === want;
    });
  }

  // For Security gate mode: use first match as the "Gate Status" member
  const gateMember = isSecurity && q && members.length > 0 ? members[0] : null;
  const gateMembership = gateMember?.membership;
  const gatePlanRaw: any = gateMembership?.membership_plans;
  const gatePlan = Array.isArray(gatePlanRaw) ? gatePlanRaw[0] : gatePlanRaw;
  const gateActiveNow = isAccessActiveAtJamaicaCutoff({
    status: gateMembership?.status ?? null,
    startDate: gateMembership?.start_date ?? null,
    paidThroughDate: gateMembership?.paid_through_date ?? null,
    durationDays: gatePlan?.duration_days ?? null,
  });

  const isPastDueGate = !gateActiveNow || (gateMembership?.status ?? "") === "past_due";
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
    if (!user) redirect("/auth/login");

    const { data: gateMembership } = await supabase
      .from("memberships")
      .select("status, start_date, paid_through_date, membership_plans(duration_days)")
      .eq("member_id", member_id)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const planRaw: any = (gateMembership as any)?.membership_plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    const canCheckIn = isAccessActiveAtJamaicaCutoff({
      status: (gateMembership as any)?.status ?? null,
      startDate: (gateMembership as any)?.start_date ?? null,
      paidThroughDate: (gateMembership as any)?.paid_through_date ?? null,
      durationDays: plan?.duration_days ?? null,
    });
    if (!canCheckIn) {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      qs.set("mid", member_id);
      qs.set("done", "inactive");
      redirect(`/members?${qs.toString()}`);
    }

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

        {showBanner && done === "inactive" ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
            <div className="font-medium">Membership expired</div>
            <div className="mt-1 opacity-80">This member cannot be checked in after expiry cutoff.</div>
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

        {error || membershipError ? (
          <div className="rounded border p-3 text-sm">
            Could not load members.
            <div className="mt-1 text-xs opacity-70">{error?.message ?? membershipError?.message}</div>
          </div>
        ) : null}

        {q && members.length === 0 && !error && !membershipError ? (
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
          <div className="oura-card p-3">
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

        {/* Always show a member list below search for security */}
        {members.length > 0 ? (
          <div className="oura-card p-3">
            <div className="flex items-center justify-between">
              <div className="font-medium">{q ? "Member list" : "Recent members"}</div>
              <div className="text-xs opacity-70">{q ? members.length : Math.min(members.length, 10)}</div>
            </div>

            <div className="mt-2 space-y-2">
              {(q ? members : members.slice(0, 10)).map((m: any) => (
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
          className="w-full oura-input px-3 py-2"
          placeholder="Search name or phone…"
        />
        <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Search
        </button>
      </form>

      {/* Errors */}
      {error || membershipError ? (
        <div className="rounded border p-3 text-sm">
          Could not load members.
          <div className="mt-1 text-xs opacity-70">{error?.message ?? membershipError?.message}</div>
        </div>
      ) : null}

      {/* Empty */}
      {!error && !membershipError && filtered.length === 0 ? (
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
