import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Role = "admin" | "front_desk" | "security";

function isDateOnly(v?: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ""));
}

function fmtJamaicaDate(v?: string | null) {
  if (!v) return "—";
  const raw = String(v);
  const d = isDateOnly(raw) ? new Date(`${raw}T12:00:00Z`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtJamaicaDateTime(ts?: string | null) {
  if (!ts) return "—";
  if (isDateOnly(ts)) return fmtJamaicaDate(ts);
  const d = new Date(String(ts));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function paymentMethodLabel(p: any) {
  return p?.payment_method ?? p?.method ?? p?.provider ?? p?.source ?? "—";
}

function paymentPaidOn(p: any) {
  return p?.paid_on ?? p?.paid_at ?? p?.created_at ?? null;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const q = (sp.q ?? "").trim();

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

  const query = supabase
    .from("payments")
    .select("id, amount, paid_on, created_at, payment_method, method, membership_id, member_id, staff_user_id")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(400);

  const { data: rawPayments, error } = await query;

  const membershipIds = Array.from(
    new Set((rawPayments ?? []).map((p: any) => p.membership_id).filter(Boolean))
  );

  const membershipsById = new Map<string, string>();
  if (membershipIds.length > 0) {
    const { data: msRows } = await supabase
      .from("memberships")
      .select("id, member_id")
      .in("id", membershipIds as string[]);
    (msRows ?? []).forEach((m: any) => {
      membershipsById.set(String(m.id), String(m.member_id));
    });
  }

  const allMemberIds = Array.from(
    new Set(
      (rawPayments ?? [])
        .map((p: any) => p.member_id || membershipsById.get(String(p.membership_id)))
        .filter(Boolean)
        .map(String)
    )
  );

  const membersById = new Map<string, any>();
  if (allMemberIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("members")
      .select("id, full_name, phone, email")
      .in("id", allMemberIds);
    (memberRows ?? []).forEach((m: any) => {
      membersById.set(String(m.id), m);
    });
  }

  const payments = (rawPayments ?? []).filter((p: any) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const resolvedMemberId = String(
      p.member_id || membershipsById.get(String(p.membership_id)) || ""
    );
    const member = membersById.get(resolvedMemberId);
    const fullName = String(member?.full_name ?? "").toLowerCase();
    const email = String(member?.email ?? "").toLowerCase();
    const phone = String(member?.phone ?? "").toLowerCase();
    return fullName.includes(needle) || email.includes(needle) || phone.includes(needle);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Payments</h1>
          <p className="text-sm opacity-70">Recent payments recorded at the desk</p>
        </div>
      </div>

      <form action="/payments" method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          className="w-full oura-input px-3 py-2"
          placeholder="Search member name, email, or phone…"
        />
        <button className="rounded border px-3 py-2 text-sm hover:oura-surface-muted">
          Search
        </button>
      </form>

      {error ? (
        <div className="rounded border p-3 text-sm">
          Could not load payments.
          <div className="mt-1 text-xs opacity-70">{error.message}</div>
        </div>
      ) : null}

      {!error && (!payments || payments.length === 0) ? (
        <div className="rounded border p-3 text-sm opacity-70">
          No payments found{q ? " for that search" : ""}.
        </div>
      ) : null}

      <div className="space-y-2">
        {(payments ?? []).map((p: any) => {
          const resolvedMemberId = String(
            p.member_id || membershipsById.get(String(p.membership_id)) || ""
          );
          const member = membersById.get(resolvedMemberId);
          const name = member?.full_name || "Member unknown";
          const meta = [member?.email, member?.phone].filter(Boolean).join(" • ");

          const paidOn = fmtJamaicaDate(paymentPaidOn(p));
          const recordedAt = fmtJamaicaDateTime(p.created_at);
          const method = paymentMethodLabel(p);
          const href = resolvedMemberId ? `/members/${resolvedMemberId}` : "#";

          return (
            <Link
              key={p.id}
              href={href}
              className="block oura-card p-3 hover:bg-white/5"
              aria-disabled={!resolvedMemberId}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{name}</div>
                  {meta ? <div className="text-sm opacity-70">{meta}</div> : null}
                  <div className="text-xs opacity-70">Paid on: {paidOn} • Method: {method}</div>
                  <div className="text-xs opacity-60">Recorded: {recordedAt}</div>
                </div>
                <div className="font-semibold">${Number(p.amount ?? 0).toFixed(2)}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
