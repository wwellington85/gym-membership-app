"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function createMemberAccount(formData: FormData) {
  const applicationId = String(formData.get("applicationId") || "").trim();
  const password = String(formData.get("password") || "").trim();

  if (!applicationId) redirect("/join/create-account?err=Missing%20application%20id");
  if (!password || password.length < 8) redirect(`/join/create-account?applicationId=${encodeURIComponent(applicationId)}&err=Password%20must%20be%20at%20least%208%20characters`);

  const supabase = await createClient();
  const admin = createAdminClient();

  // Fetch the application (server-side)
  const { data: appRow, error: appErr } = await supabase
    .from("membership_applications")
    .select("id, full_name, phone, email, user_id, status")
    .eq("id", applicationId)
    .single();

  if (appErr || !appRow) {
    redirect(`/join/create-account?applicationId=${encodeURIComponent(applicationId)}&err=Application%20not%20found`);
  }

  if (!appRow.email) {
    redirect(`/join/create-account?applicationId=${encodeURIComponent(applicationId)}&err=Email%20missing%20on%20application`);
  }

  // If already linked, just sign in
  if (!appRow.user_id) {
    // Create auth user (service role)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: appRow.email,
      password,
      email_confirm: true,
      user_metadata: { is_member: true },
    });

    if (createErr || !created?.user) {
      redirect(`/join/create-account?applicationId=${encodeURIComponent(applicationId)}&err=${encodeURIComponent(createErr?.message || "Could not create user")}`);
    }

    const userId = created.user.id;

    // Link application -> auth user
    const { error: linkErr } = await supabase
      .from("membership_applications")
      .update({ user_id: userId })
      .eq("id", applicationId);

    if (linkErr) {
      redirect(`/join/create-account?applicationId=${encodeURIComponent(applicationId)}&err=${encodeURIComponent(linkErr.message)}`);
    }

    // Create member row (so they can land in member app immediately)
    // We keep it simple: create if missing, else attach user_id.
    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("email", appRow.email)
      .maybeSingle();

    if (existingMember?.id) {
      await supabase.from("members").update({ user_id: userId }).eq("id", existingMember.id);
    } else {
      await supabase.from("members").insert({
        full_name: appRow.full_name,
        phone: appRow.phone,
        email: appRow.email,
        user_id: userId,
      });
    }
  }

  // Sign them in (sets cookies)
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: appRow.email,
    password,
  });

  if (signInErr) {
    redirect(`/auth/login?err=${encodeURIComponent(signInErr.message)}`);
  }

  redirect("/member");
}
