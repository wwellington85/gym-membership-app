import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Role = "admin" | "front_desk" | "security";

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

  // Join: payments -> memberships -> members
  let query = supabase
    .from("payments")
    .select(
      "id, amount, paid_on, payment_method, membership_id, memberships(member_id, members(full_name, phone, email))"
    )
    .order("paid_on", { ascending: false })
    .limit(200);

  if (q) {
    query = query.or(
      `memberships.members.full_name.ilike.%${q}%,memberships.members.email.ilike.%${q}%,memberships.members.phone.ilike.%${q}%`
    );
  }

  const { data: payments, error } = await query;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm opacity-70">Recent payments recorded at the desk</p>
      </div>

      <form action="/payments" method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          className="w-full rounded border px-3 py-2"
          placeholder="Search member name, email, or phone…"
        />
        <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
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
          const member = p.memberships?.members;
          const name = member?.full_name || "Member unknown";
          const meta = [member?.email, member?.phone].filter(Boolean).join(" • ");
          return (
            <div key={p.id} className="oura-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{name}</div>
                  {meta ? <div className="text-sm opacity-70">{meta}</div> : null}
                  <div className="text-xs opacity-60">
                    Paid on: {p.paid_on} • Method: {p.payment_method || "—"}
                  </div>
                </div>
                <div className="font-semibold">${Number(p.amount).toFixed(2)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
