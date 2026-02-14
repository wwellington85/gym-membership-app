"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (!full_name || !phone || !plan_id || !start_date) {
    redirect("/members/new?error=missing_fields");
  }

  const email = emailRaw.length ? emailRaw : null;
  const notes = notesRaw.length ? notesRaw : null;

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

  // Record payment only if paid plan AND staff said they collected it
  if (collect_payment && price > 0) {
    const pay = await supabase.from("payments").insert({
      member_id: member.id,
      membership_id: membershipId,
      amount: price,
      paid_on: start_date,
      payment_method,
      notes: null,
    } as any);

    if (pay.error) {
      console.error("[members/new] payment insert failed:", pay.error);
      redirect(`/members/${member.id}?payment_error=1`);
    }

    // best-effort: set last_payment_date (schema supports this in your memberships table)
    await supabase
      .from("memberships")
      .update({ last_payment_date: start_date } as any)
      .eq("id", membershipId);
  }

  redirect(`/members/${member.id}`);
}
