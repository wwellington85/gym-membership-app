"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

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
  const paymentMethod = String(formData.get("payment_method") ?? "cash").trim();
  const paymentNotes = String(formData.get("payment_notes") ?? "").trim();
  const complimentaryReason = String(formData.get("complimentary_reason") ?? "").trim();
  const paymentDiscountPercentRaw = String(formData.get("payment_discount_percent") ?? "0").trim();
  const parsedDiscount = Number.parseFloat(paymentDiscountPercentRaw || "0");
  const paymentDiscountPercent = Number.isFinite(parsedDiscount) ? parsedDiscount : 0;

  if (!memberId || !planId || !startDate) {
    redirect(`/members/${memberId}?plan_error=missing_fields`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (staffProfile?.role ?? "") as string;
  const canPayments = ["admin", "front_desk"].includes(role);
  if (!canPayments) redirect(`/members/${memberId}?plan_error=forbidden`);
  if (recordPayment && paymentMethod === "complimentary" && !complimentaryReason) {
    redirect(`/members/${memberId}?plan_error=complimentary_reason_required`);
  }
  if (recordPayment && paymentMethod !== "complimentary" && (paymentDiscountPercent < 0 || paymentDiscountPercent > 100)) {
    redirect(`/members/${memberId}?plan_error=invalid_discount`);
  }

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
    isNoExpiry ? addDaysISO(startDate, 3650) : addDaysISO(startDate, Math.max(durationDays - 1, 0));

  // Update membership row
  const { error: updErr } = await supabase
    .from("memberships")
    .update({
      plan_id: plan.id,
      start_date: startDate,
      paid_through_date: paidThrough,
      status: "active",
      last_payment_date: recordPayment ? startDate : null,
    } as any)
    .eq("id", membership.id);

  if (updErr) {
    redirect(`/members/${memberId}?plan_error=update_failed`);
  }

  // Optional payment insert (desk payments)
  if (recordPayment) {
    const baseAmount = Number(plan.price ?? 0);
    const amount =
      paymentMethod === "complimentary"
        ? 0
        : Math.max(0, Number((baseAmount * (1 - paymentDiscountPercent / 100)).toFixed(2)));

    const discountNote =
      paymentMethod !== "complimentary" && paymentDiscountPercent > 0
        ? `Discount applied: ${paymentDiscountPercent}% (base $${baseAmount.toFixed(2)}).`
        : "";

    const notes =
      paymentMethod === "complimentary"
        ? `Complimentary: ${complimentaryReason}`
        : [discountNote, paymentNotes].filter(Boolean).join(" ") || null;

    const { error: payErr } = await supabase.from("payments").insert({
      membership_id: membership.id,
      member_id: memberId,
      amount,
      paid_on: startDate,
      payment_method: paymentMethod,
      notes,
      staff_user_id: user.id,
    } as any);

    if (payErr) {
      redirect(`/members/${memberId}?plan_error=payment_failed`);
    }

    redirect(`/members/${memberId}?plan=saved&payment=saved`);
  }

  redirect(`/members/${memberId}?plan=saved`);
}

export async function setMemberActiveAction(formData: FormData) {
  const supabase = await createClient();

  const memberId = String(formData.get("member_id") ?? "").trim();
  const nextActive = String(formData.get("next_active") ?? "").trim() === "1";

  if (!memberId) redirect("/members");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  // Management-only control
  if (staffProfile?.role !== "admin") {
    redirect(`/members/${memberId}?member_error=forbidden`);
  }

  const { error } = await supabase
    .from("members")
    .update({ is_active: nextActive } as any)
    .eq("id", memberId);

  if (error) {
    redirect(`/members/${memberId}?member_error=save_failed`);
  }

  redirect(`/members/${memberId}?member_saved=1`);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function updateMemberContactAction(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!memberId) redirect("/members");

  const nextPhoneRaw = String(formData.get("phone") ?? "").trim();
  const nextEmailRaw = String(formData.get("email") ?? "").trim();
  const nextPhone = nextPhoneRaw || null;
  const nextEmail = nextEmailRaw ? nextEmailRaw.toLowerCase() : null;

  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (staffProfile?.role ?? "") as string;
  if (!["admin", "front_desk"].includes(role)) {
    redirect(`/members/${memberId}?member_error=forbidden`);
  }

  if (nextEmail && !isValidEmail(nextEmail)) {
    redirect(`/members/${memberId}?member_error=invalid_email`);
  }

  const { data: member, error: memberErr } = await admin
    .from("members")
    .select("id, user_id, email")
    .eq("id", memberId)
    .single();

  if (memberErr || !member) {
    redirect(`/members/${memberId}?member_error=not_found`);
  }

  if (nextEmail) {
    const { data: matchingStaff } = await admin
      .from("staff_profiles")
      .select("user_id, is_active")
      .eq("email", nextEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (matchingStaff?.user_id && matchingStaff.user_id !== member.user_id) {
      redirect(`/members/${memberId}?member_error=email_belongs_to_staff`);
    }

    const { data: matchingMember } = await admin
      .from("members")
      .select("id")
      .eq("email", nextEmail)
      .neq("id", memberId)
      .maybeSingle();

    if (matchingMember?.id) {
      redirect(`/members/${memberId}?member_error=email_in_use`);
    }
  }

  const currentEmail = String(member.email ?? "").trim().toLowerCase();
  const emailChanged = !!nextEmail && nextEmail !== currentEmail;

  if (emailChanged && member.user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(String(member.user_id), {
      email: nextEmail!,
      email_confirm: true,
    });

    if (authError) {
      const code = String((authError as any)?.code ?? "");
      if (code === "email_exists") {
        redirect(`/members/${memberId}?member_error=email_in_use`);
      }
      redirect(`/members/${memberId}?member_error=auth_update_failed`);
    }
  }

  const payload: Record<string, any> = {
    phone: nextPhone,
  };
  if (nextEmail !== null) payload.email = nextEmail;

  const { error: updateError } = await admin
    .from("members")
    .update(payload)
    .eq("id", memberId);

  if (updateError) {
    const code = String((updateError as any)?.code ?? "");
    if (code === "23505") {
      redirect(`/members/${memberId}?member_error=email_in_use`);
    }
    redirect(`/members/${memberId}?member_error=save_failed`);
  }

  redirect(`/members/${memberId}?member_saved=1&member_update=contact`);
}

async function getOrigin() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "127.0.0.1:3000";
  return `${proto}://${host}`;
}

export async function sendMemberLoginDetailsAction(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!memberId) redirect("/members");

  const supabase = await createClient();
  const admin = createAdminClient();
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
  const role = (staffProfile.role ?? "") as string;
  if (!["admin", "front_desk"].includes(role)) {
    redirect(`/members/${memberId}?member_error=forbidden`);
  }

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("email")
    .eq("id", memberId)
    .single();

  if (memberErr || !member?.email) {
    redirect(`/members/${memberId}?member_error=no_email`);
  }
  const normalizedEmail = member.email.trim().toLowerCase();

  // Prevent member login-link sends from targeting an existing staff account.
  const { data: matchingStaff } = await admin
    .from("staff_profiles")
    .select("user_id, role, is_active, email")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (matchingStaff?.user_id) {
    redirect(`/members/${memberId}?member_error=email_belongs_to_staff`);
  }

  const origin = await getOrigin();
  const recoveryRedirectTo = `${origin}/auth/update-password?returnTo=/member`;
  const createRes = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: `${crypto.randomUUID()}Aa!`,
    email_confirm: true,
    user_metadata: { is_member: true },
  });

  const createError = createRes.error;
  const alreadyRegistered =
    !!createError &&
    /already registered|user already|exists/i.test(
      `${createError.message ?? ""} ${createError.code ?? ""}`,
    );

  if (createError && !alreadyRegistered) {
    redirect(`/members/${memberId}?member_error=${encodeURIComponent(createError.message)}`);
  }

  // Use implicit flow for recipient-triggered email links so no PKCE verifier
  // is required in the recipient's browser storage.
  const publicClient = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "implicit",
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { error } = await publicClient.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo: recoveryRedirectTo,
  });

  if (error) {
    redirect(`/members/${memberId}?member_error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/members/${memberId}?member_reset=sent`);
}
