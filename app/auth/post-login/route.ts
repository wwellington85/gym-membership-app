import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const dest = new URL("/auth/login", url);
    if (returnTo) dest.searchParams.set("returnTo", returnTo);
    return NextResponse.redirect(dest);
  }

  // 1) Staff?
  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staff?.role) {
    return NextResponse.redirect(new URL(returnTo || "/dashboard", url));
  }

  // 2) Member?
  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (member?.id) {
    return NextResponse.redirect(new URL(returnTo || "/member", url));
  }

  // 3) Logged in but no profile found
  return NextResponse.redirect(new URL("/auth/login?err=No%20member%20profile", url));
}
