"use server";

import { requireStaff } from "@/lib/auth/staff";
import { loadAccess } from "@/lib/access/server";
import { purchasePeriod } from "@/lib/access/rules";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

export async function changeMemberPlanAction(formData: FormData) {
  const { admin, user } = await requireStaff(["admin", "front_desk"]);
  const memberId = String(formData.get("member_id") || "");
  const fail = (message: string): never =>
    redirect(`/members/${memberId}?err=${encodeURIComponent(message)}`);
  const planId = String(formData.get("plan_id") || "");
  const key = String(formData.get("checkout_key") || "");
  if (!/^[0-9a-f-]{36}$/i.test(key)) fail("Reload the page before submitting.");
  const { data: plan } = await admin
    .from("membership_plans")
    .select("id, price, duration_days, grants_access")
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan?.grants_access)
    fail(
      "Select a gym or resort access product. Rewards membership remains active separately.",
    );
  const { passes } = await loadAccess(memberId);
  let period;
  try {
    period = purchasePeriod({
      start: String(formData.get("start_date") || ""),
      duration: Number(plan!.duration_days),
      planId,
      renew: formData.get("intent") === "renew",
      current: passes.find(
        (p) => p.plan_id === planId && p.status === "active",
      ),
    });
  } catch {
    fail("Choose a valid start date today or later.");
  }
  const method = String(formData.get("payment_method") || "");
  const notes = String(formData.get("payment_notes") || "")
    .trim()
    .slice(0, 1000);
  const amount =
    method === "complimentary" ? 0 : Number(formData.get("amount"));
  if (
    !["cash", "card", "bank_transfer", "other", "complimentary"].includes(
      method,
    ) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > Number(plan!.price)
  )
    fail("Check the payment amount and method.");
  if ((amount < Number(plan!.price) || method === "complimentary") && !notes)
    fail("Give a reason for a discounted or complimentary pass.");
  const { error } = await admin.rpc("grant_staff_access", {
    p_member_id: memberId,
    p_plan_id: planId,
    p_start: period!.start,
    p_record_payment: true,
    p_method: method,
    p_amount: amount,
    p_notes: notes || null,
    p_staff_id: user.id,
    p_key: key,
  });
  if (error) {
    console.error("Staff access grant failed", { code: error.code, message: error.message });
    fail("Access was not saved. Refresh the record before retrying. If this continues, contact the administrator.");
  }
  redirect(`/members/${memberId}?saved=1`);
}

export async function setMemberActiveAction(formData: FormData) {
  await requireStaff(["admin"]);
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
  await requireStaff(["admin", "front_desk"]);
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!memberId) redirect("/members");

  const nextPhoneRaw = String(formData.get("phone") ?? "").trim();
  const nextEmailRaw = String(formData.get("email") ?? "").trim();
  const nextPhone = nextPhoneRaw || "";
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

  const currentEmail = String(member.email ?? "")
    .trim()
    .toLowerCase();
  const emailChanged = !!nextEmail && nextEmail !== currentEmail;

  if (emailChanged && member.user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(
      String(member.user_id),
      {
        email: nextEmail!,
        email_confirm: true,
      },
    );

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
  await requireStaff(["admin", "front_desk"]);
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
  const recoveryRedirectTo = `${origin}/auth/confirm?next=${encodeURIComponent(
    "/auth/update-password?returnTo=/member",
  )}`;
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
    redirect(
      `/members/${memberId}?member_error=${encodeURIComponent(createError.message)}`,
    );
  }

  // Use a public client for recipient-triggered email links and route back
  // through /auth/confirm so the server can complete auth before the user
  // lands on the password screen.
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

  const { error } = await publicClient.auth.resetPasswordForEmail(
    normalizedEmail,
    {
      redirectTo: recoveryRedirectTo,
    },
  );

  if (error) {
    redirect(
      `/members/${memberId}?member_error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(`/members/${memberId}?member_reset=sent`);
}
