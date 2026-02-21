export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { byCode } from "@/lib/plans/tiers";
import { isAccessActiveAtJamaicaCutoff } from "@/lib/membership/status";
import { changeMemberPlanAction, setMemberActiveAction } from "./actions";
import { ChangePlanForm } from "./ChangePlanForm";

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
  if (s === "expired") return { label: "Expired", cls: "border" };
  if (s === "active") return { label: "Active", cls: "border" };
  return { label: status ?? "—", cls: "border" };
}

function formatPlanType(t?: string | null) {
  if (t === "rewards") return "Rewards";
  if (t === "club") return "Club";
  if (t === "pass") return "Pass";
  return "Plan";
}

function pct(n: number | string | null | undefined) {
  const v =
    typeof n === "number"
      ? n
      : typeof n === "string"
      ? Number.parseFloat(n)
      : 0;

  const safe = Number.isFinite(v) ? v : 0;

  // values are stored as 0.15 etc
  return `${Math.round(safe * 100)}%`;
}

function isMissingBenefitsTable(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "PGRST205" || /membership_plan_benefits/i.test(message);
}

function benefitValueOrIncluded(raw: any) {
  const v = String(raw ?? "").trim();
  return v ? v : "Included";
}

function money(v?: number | null) {
  const n = typeof v === "number" ? v : 0;
  return n === 0 ? "Free" : `$${n}`;
}

function fmtJamaica(ts?: string | null) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/Jamaica" });
}

function paymentDateValue(p: any) {
  return p?.paid_on ?? p?.paid_at ?? p?.created_at ?? null;
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
  searchParams?: Promise<{
    payment?: string;
    checkin?: string;
    plan?: string;
    plan_error?: string;
    duplicate_prevented?: string;
    member_saved?: string;
    member_error?: string;
  }>;
}) {
  const { memberId } = await params;
  const sp = (await searchParams) ?? {};
  const paymentSaved = sp.payment === "saved";
  const paymentDuplicate = sp.payment === "duplicate";
  const checkinState = sp.checkin ?? ""; // "saved" | "already" | ""
  const checkinInactive = checkinState === "inactive";
  const planSaved = sp.plan === "saved";
  const planError = sp.plan_error ?? "";
  const duplicatePrevented = sp.duplicate_prevented === "1";
  const memberSaved = sp.member_saved === "1";
  const memberErrorQuery = sp.member_error ?? "";

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

  const admin = createAdminClient();

  const role = staffProfile.role as string;
  const canPayments = ["admin", "front_desk"].includes(role);
  const canManageMembers = role === "admin";

  const memberPromise = admin
    .from("members")
    .select("id, full_name, phone, email, notes, is_active, created_at")
    .eq("id", memberId)
    .single();

  const membershipsPromise = admin
    .from("memberships")
    .select(
      "id, plan_id, start_date, paid_through_date, status, last_payment_date, needs_contact, membership_plans(id, name, code, price, duration_days, plan_type, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa)"
    )
    .eq("member_id", memberId)
    .order("start_date", { ascending: false })
    .limit(20);

  const [memberRes, membershipsRes, recentCheckinsRes, loyaltyRes, activePlansRes] = await Promise.all([
    memberPromise,
    membershipsPromise,
    admin
      .from("checkins")
      .select("id, checked_in_at, points_earned, notes")
      .eq("member_id", memberId)
      .order("checked_in_at", { ascending: false })
      .limit(5),
    admin.from("member_loyalty_points").select("points").eq("member_id", memberId).maybeSingle(),
    admin
      .from("membership_plans")
      .select("id, name, price, duration_days, plan_type")
      .eq("is_active", true)
      .order("price", { ascending: true }),
  ]);

  const { data: member, error: memberError } = memberRes;

  if (memberError || !member) return notFound();

  const membershipRows = membershipsRes.data ?? [];
  const membership =
    membershipRows.find((row: any) => {
      const planRaw: any = row?.membership_plans;
      const rowPlan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
      return isAccessActiveAtJamaicaCutoff({
        status: row?.status ?? null,
        startDate: row?.start_date ?? null,
        paidThroughDate: row?.paid_through_date ?? null,
        durationDays: rowPlan?.duration_days ?? null,
      });
    }) ??
    membershipRows[0] ??
    null;
let plan = Array.isArray((membership as any)?.membership_plans)
    ? (membership as any).membership_plans[0]
    : (membership as any)?.membership_plans;

// Fallback: nested join may be blocked/empty under RLS; load plan directly by FK.
if (!plan && (membership as any)?.plan_id) {
  const { data: planRow } = await admin
    .from("membership_plans")
    .select(
      "id, name, code, price, duration_days, plan_type, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa"
    )
    .eq("id", String((membership as any).plan_id))
    .maybeSingle();

  plan = planRow as any;
}
  const recentCheckins = recentCheckinsRes.data ?? [];
  const loyalty = loyaltyRes.data;

  const paidThrough = membership?.paid_through_date ?? null;
  const delta = paidThrough ? daysFromToday(paidThrough) : null;

  const activeNow = isAccessActiveAtJamaicaCutoff({
    status: membership?.status ?? null,
    startDate: membership?.start_date ?? null,
    paidThroughDate: membership?.paid_through_date ?? null,
    durationDays: plan?.duration_days ?? null,
  });
  const dbStatus = String(membership?.status ?? "").toLowerCase();
  const status =
    dbStatus === "pending"
      ? "pending"
      : !activeNow
      ? "expired"
      : dbStatus === "due_soon"
      ? "due_soon"
      : "active";
  const badge = statusBadge(status);

  async function checkInNow() {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const { data: currentMembership } = await supabase
      .from("memberships")
      .select("status, start_date, paid_through_date, membership_plans(duration_days)")
      .eq("member_id", memberId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const currentPlanRaw: any = (currentMembership as any)?.membership_plans;
    const currentPlan = Array.isArray(currentPlanRaw) ? currentPlanRaw[0] : currentPlanRaw;
    const canCheckIn = isAccessActiveAtJamaicaCutoff({
      status: (currentMembership as any)?.status ?? null,
      startDate: (currentMembership as any)?.start_date ?? null,
      paidThroughDate: (currentMembership as any)?.paid_through_date ?? null,
      durationDays: currentPlan?.duration_days ?? null,
    });
    if (!canCheckIn) {
      redirect(`/members/${memberId}?checkin=inactive`);
    }

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
  let payments: any[] = [];
  let paymentsLoadError: string | null = null;

  if (canPayments) {
    const paymentSelect = "id, amount, paid_on, created_at, payment_method, membership_id, member_id, notes";

    const [byMemberRes, membershipsForMemberRes] = await Promise.all([
      admin
        .from("payments")
        .select(paymentSelect)
        .eq("member_id", memberId)
        .order("created_at", { ascending: false }),
      admin.from("memberships").select("id").eq("member_id", memberId),
    ]);

    const byMember = byMemberRes.data ?? [];
    const membershipsForMember = membershipsForMemberRes.data ?? [];
    if (byMemberRes.error) paymentsLoadError = byMemberRes.error.message;
    if (membershipsForMemberRes.error) {
      paymentsLoadError = membershipsForMemberRes.error.message;
    }

    const membershipIds = membershipsForMember.map((m: any) => m.id).filter(Boolean);
    const byMembershipRes = membershipIds.length
      ? await admin
          .from("payments")
          .select(paymentSelect)
          .in("membership_id", membershipIds)
          .order("created_at", { ascending: false })
      : { data: [] as any[], error: null as any };
    const byMembershipIds = byMembershipRes.data ?? [];
    if (byMembershipRes.error) paymentsLoadError = byMembershipRes.error.message;

    const merged = [...byMember, ...byMembershipIds];
    const dedup = new Map<string, any>();
    merged.forEach((p: any) => {
      if (p?.id && !dedup.has(String(p.id))) dedup.set(String(p.id), p);
    });

    payments = Array.from(dedup.values()).sort((a: any, b: any) => {
      const aKey = String(paymentDateValue(a) ?? "");
      const bKey = String(paymentDateValue(b) ?? "");
      return bKey.localeCompare(aKey);
    });

    // Fallback: some records may only resolve via join on memberships.member_id.
    if (payments.length === 0) {
      const fallbackRes = await admin
        .from("payments")
        .select(`${paymentSelect}, memberships!inner(member_id)`)
        .eq("memberships.member_id", memberId)
        .order("created_at", { ascending: false });

      if (fallbackRes.error) {
        paymentsLoadError = fallbackRes.error.message;
      } else {
        payments = fallbackRes.data ?? [];
      }
    }
  }

  // Compute last payment from payments list (more reliable than memberships.last_payment_date)
  const lastPaymentRow = payments && payments.length > 0 ? payments[0] : null;
  const lastPaymentLabel = lastPaymentRow
    ? (paymentDateValue(lastPaymentRow) ? String(paymentDateValue(lastPaymentRow)).slice(0, 10) : "—")
    : (membership?.last_payment_date ?? "—");

  const activePlans = activePlansRes.data ?? [];
  const tierMeta = byCode(plan?.code ?? "rewards_free");
  const discountsForDisplay =
    plan && typeof plan === "object"
      ? [
          { label: "Restaurant & Bar", value: pct(plan.discount_food) },
          { label: "Spa services", value: pct(plan.discount_spa) },
          { label: "Gift shop", value: pct(plan.discount_giftshop) },
          { label: "Watersports", value: pct(plan.discount_watersports) },
          { label: "Complimentary high-speed Wi-Fi", value: "Included" },
        ]
      : tierMeta.discounts;

  let extraBenefits: any[] = [];
  let extraBenefitsError: string | null = null;
  if (plan?.id) {
    const { data, error } = await admin
      .from("membership_plan_benefits")
      .select("id, label, value, sort_order")
      .eq("plan_id", String(plan.id))
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error && !isMissingBenefitsTable(error)) {
      extraBenefitsError = error.message;
    } else {
      extraBenefits = data ?? [];
    }
  }

  const planErrorMessage =
    planError === "complimentary_reason_required"
      ? "Complimentary requires a reason."
      : planError === "invalid_discount"
      ? "Discount must be between 0% and 100%."
      : planError === "forbidden"
      ? "You are not allowed to change plans."
      : planError === "plan_not_found"
      ? "Selected plan was not found."
      : planError
      ? "Could not save plan change. Please try again."
      : "";

  const memberErrorMessage =
    memberErrorQuery === "forbidden"
      ? "Only Management can change member active status."
      : memberErrorQuery
      ? "Could not update member status. Please try again."
      : "";

  // Status banner

  let banner: { title: string; body?: string; cls: string } | null = null;

  if (status === "expired") {
    banner = {
      title: "Expired — Action needed",
      body: delta !== null ? `Membership expired ${Math.abs(delta)} day(s) ago.` : "Membership is expired.",
      cls: "oura-card p-3 border-l-4 border-l-red-500",
    };
  } else if (status === "due_soon") {
    banner = {
      title: "Due Soon",
      body: delta !== null ? `Membership expires in ${delta} day(s).` : "Membership expires soon.",
      cls: "oura-card p-3 border-l-4 border-l-amber-500",
    };
  } else if (status === "active") {
    banner =
      delta !== null
        ? { title: "Active", body: `Membership expires in ${delta} day(s).`, cls: "oura-card p-3 border-l-4 border-l-emerald-500" }
        : { title: "Active", cls: "oura-card p-3 border-l-4 border-l-emerald-500" };
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
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
              title={!activeNow ? "Membership is expired" : alreadyCheckedInToday ? "Already checked in today" : "Record a check-in"}
              disabled={!activeNow}
            >
              Check in now
            </button>
          </form>

          {alreadyCheckedInToday ? (
            <div className="text-xs opacity-70">Already checked in today</div>
          ) : null}

          {canManageMembers ? (
            <form action={setMemberActiveAction}>
              <input type="hidden" name="member_id" value={member.id} />
              <input type="hidden" name="next_active" value={member.is_active === false ? "1" : "0"} />
              <button className="rounded border px-3 py-2 text-xs hover:bg-gray-50">
                {member.is_active === false ? "Reactivate member" : "Deactivate member"}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {/* banners */}
      {duplicatePrevented ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Duplicate submission prevented. This member already existed.
        </div>
      ) : null}

      {memberSaved ? (
        <div className="oura-alert-success p-3 text-sm">
          <div className="font-medium">Member updated</div>
          <div className="mt-1 opacity-80">
            {member.is_active === false ? "Member has been deactivated." : "Member has been reactivated."}
          </div>
        </div>
      ) : null}

      {memberErrorMessage ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {memberErrorMessage}
        </div>
      ) : null}

      {paymentSaved && canPayments ? (
        <div className="oura-alert-success p-3 text-sm">
          <div className="font-medium">Payment saved</div>
          <div className="mt-1 opacity-80">The payment was recorded successfully.</div>
        </div>
      ) : null}

      {paymentDuplicate && canPayments ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Duplicate payment prevented. A matching payment was already saved.
        </div>
      ) : null}

      {planSaved && canPayments ? (
        <div className="oura-alert-success p-3 text-sm">
          <div className="font-medium">Plan updated</div>
          <div className="mt-1 opacity-80">Membership plan and payment record were updated.</div>
        </div>
      ) : null}

      {planErrorMessage ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {planErrorMessage}
        </div>
      ) : null}

      {checkinState === "saved" ? (
        <div className="oura-alert-success p-3 text-sm">
          <div className="font-medium">Checked in</div>
          <div className="mt-1 opacity-80">Visit recorded successfully.</div>
        </div>
      ) : null}

      {checkinState === "already" ? (
        <p className="text-sm font-medium opacity-90">This member already checked in today.</p>
      ) : null}

      {checkinInactive ? (
        <p className="text-sm font-medium opacity-90">Membership is expired and cannot check in.</p>
      ) : null}

      <div className="oura-card p-3">
        <div className="flex items-center justify-between">
          <div className="font-medium">Membership</div>
          <span className={`rounded px-2 py-1 text-xs ${badge.cls}`}>{badge.label}</span>
        </div>


        {plan ? (
          <div className="mt-3 rounded border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="oura-alert-title">
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

            <div className="mt-3 divide-y divide-white/10 rounded border">
              {discountsForDisplay.map((d) => (
                <div key={d.label} className="flex items-center justify-between p-2 text-sm">
                  <div className="opacity-80">{d.label}</div>
                  <div className="font-medium">{d.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded border p-3">
              <div className="text-sm font-medium">Facility access</div>
              {tierMeta.access.length === 0 ? (
                <p className="mt-2 text-sm opacity-70">No facility access included.</p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tierMeta.access.map((item) => (
                    <div key={item} className="rounded border p-2 text-sm opacity-90">
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {extraBenefitsError ? (
              <div className="mt-3 rounded border p-2 text-xs opacity-80">
                Could not load custom benefits: {extraBenefitsError}
              </div>
            ) : null}

            {extraBenefits.length > 0 ? (
              <div className="mt-3 rounded border p-3">
                <div className="text-sm font-medium">Extra benefits for this plan</div>
                <div className="mt-2 divide-y divide-white/10">
                  {extraBenefits.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between p-2 text-sm">
                      <div className="opacity-80">{b.label}</div>
                      <div className="font-medium">{benefitValueOrIncluded(b.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {tierMeta.notes?.length ? (
              <div className="mt-3 rounded border p-3 text-sm">
                <div className="font-medium">Notes</div>
                <ul className="mt-2 list-disc pl-5 opacity-80">
                  {tierMeta.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 text-sm opacity-70">No plan assigned.</div>
        )}
        


        
        <div className="mt-3 space-y-1 text-sm">
          <div>Plan: {plan?.name ?? "—"}</div>
          <div>Start date: {membership?.start_date ?? "—"}</div>
          <div>Paid-through: {membership?.paid_through_date ?? "—"}</div>
          <div>Last payment: {lastPaymentLabel}</div>
        
          {member.notes ? (
            <div className="mt-2 text-sm">
              <span className="opacity-70">Notes:</span>{" "}
              <span className="whitespace-pre-wrap">{member.notes}</span>
            </div>
          ) : null}
</div>
      </div>

      {canPayments ? (
        <div className="oura-card p-3">
          <div className="font-medium">Change plan</div>
          <div className="mt-1 text-sm opacity-70">
            Update this member’s plan and optionally record payment now.
          </div>
          <div className="mt-3">
            <ChangePlanForm
              memberId={member.id}
              currentPlanId={(membership as any)?.plan_id ?? null}
              plans={(activePlans ?? []) as any[]}
              action={changeMemberPlanAction}
            />
          </div>
        </div>
      ) : null}

      

            {banner ? (
        <div className={`mt-3 ${banner.cls}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{banner.title}</div>
              {banner.body ? <div className="mt-1 text-sm opacity-70">{banner.body}</div> : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`tel:${member.phone}`}
                className="rounded border px-3 py-1.5 text-xs hover:bg-white/5"
              >
                Call
              </a>

              {canPayments ? (
                <Link
                  href={`/members/${member.id}/add-payment`}
                  className="rounded border px-3 py-1.5 text-xs hover:bg-white/5"
                >
                  Record payment
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

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

          {paymentsLoadError ? (
            <div className="rounded border p-3 text-sm">
              Could not load payments.
              <div className="mt-1 text-xs opacity-70">{paymentsLoadError}</div>
            </div>
          ) : null}

          {!paymentsLoadError && (!payments || payments.length === 0) ? (
            <div className="rounded border p-3 text-sm opacity-70">No payments recorded yet.</div>
          ) : null}

          {!paymentsLoadError && payments && payments.length > 0 ? (
            <div className="space-y-2">
              {payments.map((p: any) => (
                <div key={p.id} className="oura-card p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">${p.amount}</div>
                      <div className="text-sm opacity-70">Paid on: {paymentDateValue(p) ? String(paymentDateValue(p)).slice(0, 10) : "—"}</div>
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
          ) : null}
        </div>
      ) : null}

      <div className="pt-2">
        <Link className="underline underline-offset-2" href="/members">
          Back to Members
        </Link>
      </div>

      {paymentSaved && canPayments ? (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 shadow-lg">
          Payment saved.
        </div>
      ) : null}

      {paymentDuplicate && canPayments ? (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+92px)] left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 shadow-lg">
          Duplicate payment prevented.
        </div>
      ) : null}
    </div>
  );
}
