import type { SupabaseClient } from "@supabase/supabase-js";

function addDaysISO(startYmd: string, days: number) {
  const [y, m, d] = startYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function applyMembershipPlan(args: {
  supabase: SupabaseClient;
  membershipId: string;
  memberId: string;
  plan: { id: string; price: number; duration_days: number };
  startDate: string;
  recordPayment: boolean;
  paymentMethod: string;
  paymentAmount?: number;
  paymentNotes?: string | null;
}) {
  const {
    supabase,
    membershipId,
    memberId,
    plan,
    startDate,
    recordPayment,
    paymentMethod,
    paymentAmount,
    paymentNotes,
  } = args;

  const durationDays = Number(plan.duration_days ?? 0);
  const isNoExpiry = durationDays >= 3650;

  const paidThrough = isNoExpiry
    ? addDaysISO(startDate, 3650)
    : addDaysISO(startDate, Math.max(durationDays, 1));

  // Update membership consistently
  const { error: updErr } = await supabase
    .from("memberships")
    .update({
      plan_id: plan.id,
      start_date: startDate,
      paid_through_date: paidThrough,
      status: "active",
      last_payment_date: recordPayment && Number(plan.price) > 0 ? startDate : null,
    } as any)
    .eq("id", membershipId);

  if (updErr) return { error: updErr };

  // Optional payment insert
  if (recordPayment && Number(plan.price) > 0) {
    const amount =
      typeof paymentAmount === "number" && Number.isFinite(paymentAmount)
        ? Math.max(0, Number(paymentAmount.toFixed(2)))
        : Number(plan.price);

    const { error: payErr } = await supabase.from("payments").insert({
      membership_id: membershipId,
      member_id: memberId,
      amount,
      paid_on: startDate,
      payment_method: paymentMethod,
      notes: paymentNotes ?? null,
    } as any);

    if (payErr) return { error: payErr };
  }

  return { error: null, paidThrough };
}
