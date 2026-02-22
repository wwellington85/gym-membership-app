"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyMembershipPlan } from "@/lib/membership/applyPlan";

export async function createMember(formData: FormData) {
  const supabase = await createClient();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const plan_id = String(formData.get("plan_id") ?? "").trim();
  const start_date = String(formData.get("start_date") ?? "").trim();

  const collect_payment = String(formData.get("collect_payment") ?? "") === "yes";
  const payment_method = String(formData.get("payment_method") ?? "").trim() || "cash";
  const paymentDiscountPercentRaw = String(formData.get("payment_discount_percent") ?? "0").trim();
  const parsedDiscount = Number.parseFloat(paymentDiscountPercentRaw || "0");
  const paymentDiscountPercent = Number.isFinite(parsedDiscount) ? parsedDiscount : 0;

  if (!full_name || !phone || !plan_id || !start_date) {
    redirect("/members/new?error=missing_fields");
  }
  if (collect_payment && payment_method !== "comp" && (paymentDiscountPercent < 0 || paymentDiscountPercent > 100)) {
    redirect("/members/new?error=invalid_discount");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const email = emailRaw.length ? emailRaw : null;
  const notes = notesRaw.length ? notesRaw : null;

  // Duplicate-submit guard: if an identical name+phone was just created in the last 2 minutes,
  // treat this submit as a duplicate and send staff to the existing profile.
  const { data: recentDup } = await supabase
    .from("members")
    .select("id, created_at")
    .eq("full_name", full_name)
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentDup?.id && recentDup?.created_at) {
    const createdMs = new Date(recentDup.created_at).getTime();
    if (Number.isFinite(createdMs) && Date.now() - createdMs < 2 * 60 * 1000) {
      redirect(`/members/${recentDup.id}?duplicate_prevented=1`);
    }
  }

  // Fetch plan
  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("id,name,price,duration_days,plan_type,code")
    .eq("id", plan_id)
    .single();

  if (planErr || !plan) {
    redirect("/members/new?error=plan_not_found");
  }

  const price = typeof (plan as any).price === "number" ? (plan as any).price : 0;
  const discountedAmount =
    payment_method === "comp"
      ? 0
      : Math.max(0, Number((Number(price) * (1 - paymentDiscountPercent / 100)).toFixed(2)));
  const paymentNotes =
    collect_payment && payment_method !== "comp" && paymentDiscountPercent > 0
      ? `Discount applied: ${paymentDiscountPercent}% (base $${Number(price).toFixed(2)}).`
      : null;

  // Create member
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .insert({ full_name, phone, email, notes } as any)
    .select("*")
    .single();

  if (memberErr || !member) {
    console.error("[members/new] member insert failed:", memberErr);
    redirect("/members/new?error=member_insert_failed");
  }

  // Create or update membership (handle triggers that created a default membership)
  let membershipId: string | null = null;

  {
    const ins = await supabase
      .from("memberships")
      .insert({ member_id: member.id, plan_id, start_date } as any)
      .select("id")
      .single();

    if (!ins.error && ins.data?.id) {
      membershipId = ins.data.id;
    } else {
      // If membership already exists for member_id, update it instead of failing
      if ((ins.error as any)?.code === "23505") {
        const existing = await supabase
          .from("memberships")
          .select("id")
          .eq("member_id", member.id)
          .maybeSingle();

        if (existing.data?.id) {
          membershipId = existing.data.id;

          const upd = await supabase
            .from("memberships")
            .update({ plan_id, start_date } as any)
            .eq("id", membershipId);

          if (upd.error) {
            console.error("[members/new] membership update failed:", upd.error);
            redirect(`/members/${member.id}?membership_error=1`);
          }
        } else {
          console.error("[members/new] membership exists but could not fetch it:", ins.error);
          redirect(`/members/${member.id}?membership_error=1`);
        }
      } else {
        console.error("[members/new] membership insert failed:", ins.error);
        redirect(`/members/${member.id}?membership_error=1`);
      }
    }
  }

  if (!membershipId) {
    redirect(`/members/${member.id}?membership_error=1`);
  }

  // Apply plan + optionally record payment (centralized logic)
  {
    const res = await applyMembershipPlan({
      supabase,
      membershipId,
      memberId: member.id,
      plan: { id: plan.id, price: Number(price), duration_days: Number((plan as any).duration_days ?? 0) },
      startDate: start_date,
      recordPayment: collect_payment && price > 0,
      paymentMethod: payment_method || "cash",
      staffUserId: user.id,
      paymentAmount: discountedAmount,
      paymentNotes,
    });

    if (res?.error) {
      console.error("[members/new] applyMembershipPlan failed:", res.error);
      redirect(`/members/${member.id}?membership_error=1`);
    }
  }

  redirect(`/members/${member.id}`);
}
