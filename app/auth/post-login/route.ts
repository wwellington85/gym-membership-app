import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeReturnTo } from "@/lib/auth/return-to";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();

  if (userErr) {
    return NextResponse.redirect(
      new URL(`/auth/login?err=${encodeURIComponent(userErr.message)}`, url)
    );
  }

  if (!user) {
    const dest = new URL("/auth/login", url);
    if (returnTo) dest.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(dest);
  }

  const admin = createAdminClient();

  // 1) Staff? (admin client bypasses RLS so we don't mis-route staff to /member)
  const { data: staff, error: staffErr } = await admin
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffErr) {
    return NextResponse.redirect(
      new URL(`/auth/login?err=${encodeURIComponent(staffErr.message)}`, url)
    );
  }

  if (staff?.role) {
    // Staff should not be redirected into member routes
    const staffReturnTo = returnTo && returnTo.startsWith("/member") ? "" : returnTo;
    return NextResponse.redirect(new URL(staffReturnTo || "/dashboard", url));
  }

  // 2) Member? (self-heal if missing)
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberErr) {
    return NextResponse.redirect(
      new URL("/auth/login?err=" + encodeURIComponent(memberErr.message), url)
    );
  }

  if (member?.id) {
    const memberReturnTo = returnTo && returnTo.startsWith("/member") ? returnTo : "";
    return NextResponse.redirect(new URL(memberReturnTo || "/member", url));
  }

  // Create member row if it doesn't exist (service role bypasses RLS)
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
    return NextResponse.redirect(
      new URL(`/auth/login?err=${encodeURIComponent(ensureErr.message)}`, url)
    );
  }

  const memberReturnTo2 = returnTo && returnTo.startsWith("/member") ? returnTo : "";
  return NextResponse.redirect(new URL(memberReturnTo2 || "/member", url));
}
