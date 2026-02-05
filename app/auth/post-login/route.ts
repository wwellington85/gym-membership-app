import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo");

  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.redirect(new URL(`/auth/login?err=${encodeURIComponent(userErr.message)}`, url));
  }

  if (!user) {
    const dest = new URL("/auth/login", url);
    if (returnTo) dest.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(dest);
  }

  // 1) Staff?
  const { data: staff, error: staffErr } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffErr && staff?.role) {
    return NextResponse.redirect(new URL(returnTo || "/dashboard", url));
  }

  // 2) Member? (self-heal if missing)
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.id) {
    return NextResponse.redirect(new URL(returnTo || "/member", url));
  }

  // Create member row if it doesn't exist (service role bypasses RLS)
  const admin = createAdminClient();
  const email = (user.email || "").toLowerCase();
  const full_name =
    (user.user_metadata?.full_name as string | undefined) ||
    (email ? email.split("@")[0] : "Member");

  const phone = (user.user_metadata?.phone as string | undefined) || "";

  const { error: ensureErr } = await admin
    .from("members")
    .upsert(
      {
        user_id: user.id,
        email,
        full_name,
        phone,
        notes: null,
      },
      { onConflict: "user_id" }
    );

  if (ensureErr) {
    return NextResponse.redirect(new URL(`/auth/login?err=${encodeURIComponent(ensureErr.message)}`, url));
  }

  return NextResponse.redirect(new URL(returnTo || "/member", url));
}
