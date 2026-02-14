"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function addDaysISO(startYmd: string, days: number) {
  // startYmd is YYYY-MM-DD
  const [y, m, d] = startYmd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export async function changeMemberPlanAction(formData: FormData) {
  const supabase = await createClient();

  const memberId = String(formData.get("member_id") ?? "").trim();
  const planId = String(formData.get("plan_id") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();

  const recordPayment = String(formData.get("record_payment") ?? "no") === "yes";
  const paymentMethod = String(formData.get("payment_method") ?? "cash");

  if (!memberId || !planId || !startDate) {
    redirect(`/members/${memberId}?plan_error=missing_fields`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (staffProfile?.role ?? "") as string;
  const canPayments = ["admin", "front_desk"].includes(role);
  if (!canPayments) redirect(`/members/${memberId}?plan_error=forbidden`);

  // Load plan
  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("id, name, price, duration_days, plan_type")
    .eq("id", planId)
    .single();

  if (planErr || !plan) {
    redirect(`/members/${memberId}?plan_error=plan_not_found`);
  }

  // Load existing membership row (unique per member)
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("id")
    .eq("member_id", memberId)
    .maybeSingle();

  if (memErr || !membership?.id) {
    redirect(`/members/${memberId}?plan_error=no_membership_row`);
  }

  // Compute paid_through_date
  // If duration_days is huge (no expiry) or price is 0, we still set paid_through_date far out so UI stays "active".
  const durationDays = Number(plan.duration_days ?? 0);
  const isNoExpiry = durationDays >= 3650;
  const paidThrough =
    isNoExpiry ? addDaysISO(startDate, 3650) : addDaysISO(startDate, Math.max(durationDays, 1));

  // Update membership row
  const { error: updErr } = await supabase
    .from("memberships")
    .update({
      plan_id: plan.id,
      start_date: startDate,
      paid_through_date: paidThrough,
      status: "active",
      last_payment_date: recordPayment && Number(plan.price) > 0 ? startDate : null,
    } as any)
    .eq("id", membership.id);

  if (updErr) {
    redirect(`/members/${memberId}?plan_error=update_failed`);
  }

  // Optional payment insert (desk payments)
  if (recordPayment && Number(plan.price) > 0) {
    const { error: payErr } = await supabase.from("payments").insert({
      membership_id: membership.id,
      member_id: memberId,
      amount: Number(plan.price),
      paid_on: startDate,
      payment_method: paymentMethod,
    } as any);

    if (payErr) {
      redirect(`/members/${memberId}?plan_error=payment_failed`);
    }

    redirect(`/members/${memberId}?plan=saved&payment=saved`);
  }

  redirect(`/members/${memberId}?plan=saved`);
}
