import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";

export async function GET() {
  const respond = (destination: string) =>
    NextResponse.json(
      { destination },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return respond("/auth/login");
  const admin = createAdminClient();
  const staff = await admin
    .from("staff_profiles")
    .select("role,is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (staff.error)
    return NextResponse.json(
      { error: "Account destination unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  if (
    staff.data &&
    ["admin", "front_desk", "security"].includes(staff.data.role)
  ) {
    if (staff.data.is_active === false) {
      await supabase.auth.signOut();
      return respond("/auth/login");
    }
    return respond(
      staff.data.role === "security" ? "/checkins/scan" : "/dashboard",
    );
  }
  const member = await admin
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (member.error)
    return NextResponse.json(
      { error: "Account destination unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  // Existing members need no repeat membership writes during app startup.
  // Account linking/enrolment remains in the established verified-email flow.
  return respond(member.data ? "/member" : "/auth/post-login");
}
