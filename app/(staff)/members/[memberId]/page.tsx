export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

function daysFromToday(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const targetUtc = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((targetUtc - todayUtc) / msPerDay);
}

function statusBadge(status?: string | null) {
  const s = (status ?? "").toLowerCase();
  if (s === "past_due") return { label: "Past Due", cls: "border" };
  if (s === "due_soon") return { label: "Due Soon", cls: "border" };
  if (s === "active") return { label: "Active", cls: "border" };
  return { label: status ?? "—", cls: "border" };
}

function formatPlanType(t?: string | null) {
  if (t === "rewards") return "Rewards";
  if (t === "club") return "Club";
  if (t === "pass") return "Pass";
  return "Plan";
}

function pct(v?: number | null) {
  const n = typeof v === "number" ? v : 0;
  return `${Math.round(n * 100)}%`;
}

function money(v?: number | null) {
  const n = typeof v === "number" ? v : 0;
  return n === 0 ? "Free" : `$${n}`;
}

function fmtJamaica(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/Jamaica" });
}

function jamaicaDayRangeUtc() {
  const offsetMs = 5 * 60 * 60 * 1000; // Jamaica UTC-5
  const now = new Date();
  const jmLocal = new Date(now.getTime() - offsetMs);
  jmLocal.setHours(0, 0, 0, 0);
  const startUtc = new Date(jmLocal.getTime() + offsetMs);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

export default async function MemberProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams?: Promise<{ payment?: string; checkin?: string }>;
}) {
  const { memberId } = await params;
  const sp = (await searchParams) ?? {};
  const paymentSaved = sp.payment === "saved";
  const checkinState = sp.checkin ?? ""; // "saved" | "already" | ""

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

  const role = staffProfile.role as string;const canPayments = ["admin", "front_desk"].includes(role);

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, full_name, phone, email, notes, created_at")
    .eq("id", memberId)
    .single();

  if (memberError || !member) return notFound();

  const { data: membership } = await supabase
    .from("memberships")
    .select(
      "id, start_date, paid_through_date, status, last_payment_date, needs_contact, membership_plans(name, code, price, duration_days, plan_type, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa), payments:payments(count), payment_rows:payments(id, amount, paid_on, payment_method)"
    )
    .eq("member_id", memberId)
    .maybeSingle();

  const plan = Array.isArray(membership?.membership_plans)
    ? membership.membership_plans[0]
    : membership?.membership_plans;
const { data: recentCheckins } = await supabase
    .from("checkins")
    .select("id, checked_in_at, points_earned, notes")
    .eq("member_id", memberId)
    .order("checked_in_at", { ascending: false })
    .limit(5);

  const { data: loyalty } = await supabase
    .from("member_loyalty_points")
    .select("points")
    .eq("member_id", memberId)
    .maybeSingle();

  const paidThrough = membership?.paid_through_date ?? null;
  const delta = paidThrough ? daysFromToday(paidThrough) : null;

  const status = membership?.status ?? null;
  const badge = statusBadge(status);

  async function checkInNow() {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("int_value")
      .eq("key", "points_per_checkin")
      .maybeSingle();

    const pointsEarned = settingRow?.int_value ?? 1;

    const { error } = await supabase.from("checkins").insert({
      member_id: memberId,
      staff_user_id: user.id,
      points_earned: pointsEarned,
    });

    if (error) {
      if ((error as any).code === "23505") redirect(`/members/${memberId}?checkin=already`);
      throw new Error(`Check-in failed: ${error.message}`);
    }

    redirect(`/members/${memberId}?checkin=saved`);
  }

  const { startUtc, endUtc } = jamaicaDayRangeUtc();
  const alreadyCheckedInToday =
    (recentCheckins ?? []).some((c) => {
      const t = new Date(c.checked_in_at).getTime();
      return t >= startUtc.getTime() && t < endUtc.getTime();
    });

  // Payment list only for Admin/Front Desk
  const payments = !canPayments || !membership?.id
    ? []
    : (await supabase
        .from("payments")
        .select("id, amount, paid_on, payment_method, membership_id")
        .eq("membership_id", membership.id)
        .order("paid_on", { ascending: false })
      ).data ?? [];

  // Status banner
  let banner: { title: string; body?: string; cls: string } | null = null;

  if (status === "past_due") {
    banner = {
      title: "Past Due — Action needed",
      body: delta !== null ? `Membership expired ${Math.abs(delta)} day(s) ago.` : "Membership is expired.",
      cls: "border border-red-200 bg-red-50",
    };
  } else if (status === "due_soon") {
    banner = {
      title: "Due Soon",
      body: delta !== null ? `Membership expires in ${delta} day(s).` : "Membership expires soon.",
      cls: "border border-amber-200 bg-amber-50",
    };
  } else if (status === "active") {
    banner =
      delta !== null
        ? { title: "Active", body: `Membership expires in ${delta} day(s).`, cls: "border border-emerald-200 bg-emerald-50" }
        : { title: "Active", cls: "border border-emerald-200 bg-emerald-50" };
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{member.full_name}</h1>
          <div className="text-sm opacity-70">{member.phone}</div>
          {member.email ? <div className="text-sm opacity-70">{member.email}</div> : null}
          <div className="mt-1 text-xs opacity-70">
            Loyalty points: <span className="font-medium">{loyalty?.points ?? 0}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          {canPayments ? (
            <Link
              href={`/members/${member.id}/add-payment`}
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              + Add Payment
            </Link>
          ) : null}

          <form action={checkInNow}>
            <button
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
              title={alreadyCheckedInToday ? "Already checked in today" : "Record a check-in"}
            >
              Check in now
            </button>
          </form>

          {alreadyCheckedInToday ? (
            <div className="text-xs opacity-70">Already checked in today</div>
          ) : null}
        </div>
      </div>

      {/* banners */}
      {paymentSaved && canPayments ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-medium">Payment saved</div>
          <div className="mt-1 opacity-80">The payment was recorded successfully.</div>
        </div>
      ) : null}

      {checkinState === "saved" ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-medium">Checked in</div>
          <div className="mt-1 opacity-80">Visit recorded successfully.</div>
        </div>
      ) : null}

      {checkinState === "already" ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="font-medium">Already checked in</div>
          <div className="mt-1 opacity-80">This member already checked in today.</div>
        </div>
      ) : null}

      <div className="oura-card p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Membership</div>
          <span className={`rounded px-2 py-1 text-xs ${badge.cls}`}>{badge.label}</span>
        </div>


        {plan ? (
          <div className="mt-3 rounded border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-medium">
                {formatPlanType(plan.plan_type)}: {plan.name}
              </div>
              <div className="text-xs opacity-70">
                {money(plan.price)} • {plan.duration_days} day(s)
              </div>
            </div>

            <div className="mt-2 text-sm">
              <span className="opacity-70">Access:</span>{" "}
              <span className="font-medium">
                {plan.grants_access ? "Allowed" : "Discounts only"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Food</div>
                <div className="font-medium">{pct(plan.discount_food)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Watersports</div>
                <div className="font-medium">{pct(plan.discount_watersports)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Gift Shop</div>
                <div className="font-medium">{pct(plan.discount_giftshop)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Spa</div>
                <div className="font-medium">{pct(plan.discount_spa)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm opacity-70">No plan assigned.</div>
        )}
        {banner ? (
          <div className={`mt-3 rounded p-3 ${banner.cls}`}>
            <div className="text-sm font-medium">{banner.title}</div>
            {banner.body ? <div className="mt-1 text-sm opacity-80">{banner.body}</div> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={`tel:${member.phone}`}
                className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
              >
                Call member
              </a>

              {canPayments ? (
                <Link
                  href={`/members/${member.id}/add-payment`}
                  className="rounded border bg-white px-3 py-1.5 text-xs hover:bg-gray-50"
                >
                  Record payment
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-3 space-y-1 text-sm">
          <div>Plan: {plan?.name ?? "—"}</div>
          <div>Start date: {membership?.start_date ?? "—"}</div>
          <div>Paid-through: {membership?.paid_through_date ?? "—"}</div>
          <div>Last payment: {membership?.last_payment_date ?? "—"}</div>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent check-ins</h2>
          <span className="text-xs opacity-70">{recentCheckins?.length ?? 0}</span>
        </div>

        {!recentCheckins || recentCheckins.length === 0 ? (
          <div className="mt-2 text-sm opacity-70">No check-ins recorded yet.</div>
        ) : (
          <div className="mt-2 space-y-2">
            {recentCheckins.map((c: any) => (
              <div key={c.id} className="oura-card p-3">
                <div className="font-medium text-sm">{fmtJamaica(c.checked_in_at)}</div>
                <div className="text-xs opacity-70">
                  Points: {c.points_earned ?? 1}
                  {c.notes ? ` · ${c.notes}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payments hidden from Security */}
      {canPayments ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Payments</h2>
            <span className="text-xs opacity-70">{payments?.length ?? 0}</span>
          </div>

          {!payments || payments.length === 0 ? (
            <div className="rounded border p-3 text-sm opacity-70">No payments recorded yet.</div>
          ) : (
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="oura-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">${p.amount}</div>
                      <div className="text-sm opacity-70">Paid on: {p.paid_on}</div>
                      {p.payment_method ? (
                        <div className="text-xs opacity-70">Method: {p.payment_method}</div>
                      ) : null}
                      {p.notes ? <div className="mt-1 text-xs opacity-70">{p.notes}</div> : null}
                    </div>
                    <div className="text-xs opacity-60">{p.created_at?.slice(0, 10)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="pt-2">
        <Link className="underline underline-offset-2" href="/members">
          Back to Members
        </Link>
      </div>
    </div>
  );
}
