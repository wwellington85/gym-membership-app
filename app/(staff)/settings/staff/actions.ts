"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withParam } from "@/lib/auth/return-to";

export async function setStaffPassword(formData: FormData) {
  // Only return to this management screen, preserving its search filters.
  const rawReturnTo = String(formData.get("returnTo") || "");
  const backTo = rawReturnTo === "/settings/staff" || rawReturnTo.startsWith("/settings/staff?")
    ? rawReturnTo
    : "/settings/staff";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: me, error: profileError } = await supabase
    .from("staff_profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !me || me.role !== "admin" || me.is_active !== true) {
    redirect("/dashboard");
  }

  const targetUserId = String(formData.get("user_id") || "").trim();
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  if (!targetUserId) redirect(withParam(backTo, "err", "Missing staff account"));
  if (password.length < 8) {
    redirect(withParam(backTo, "err", "Password must be at least 8 characters"));
  }
  if (password !== confirm) redirect(withParam(backTo, "err", "Passwords do not match"));

  const admin = createAdminClient();
  // Resolve the target on the server; never accept an arbitrary Auth user ID.
  const { data: target, error: targetError } = await admin
    .from("staff_profiles")
    .select("user_id, email")
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (targetError || !target) {
    redirect(withParam(backTo, "err", "Staff account could not be found"));
  }
  if (target.email && !target.email.toLowerCase().endsWith("@staff.local")) {
    redirect(withParam(backTo, "err", "Use the password reset email for staff with an email address"));
  }

  const { error } = await admin.auth.admin.updateUserById(target.user_id, { password });
  if (error) redirect(withParam(backTo, "err", error.message));

  redirect(withParam(backTo, "saved", "1"));
}
