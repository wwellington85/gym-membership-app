import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeReturnTo } from "@/lib/auth/return-to";
import { jamaicaTodayYmd } from "@/lib/membership/status";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const memberReturn =
    returnTo.split(/[?#]/, 1)[0] === "/member" ||
    returnTo.startsWith("/member/");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/auth/login", url));
  const admin = createAdminClient();
  const { data: staff, error: staffError } = await admin
    .from("staff_profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  const fail = () =>
    NextResponse.redirect(
      new URL(
        "/auth/login?err=We%20could%20not%20finish%20account%20setup.%20Please%20contact%20the%20front%20desk.",
        url,
      ),
    );
  if (staffError) return fail();
  if (staff && ["admin", "front_desk", "security"].includes(staff.role)) {
    if (staff.is_active === false) {
      await supabase.auth.signOut();
      return fail();
    }
    return NextResponse.redirect(
      new URL(
        returnTo && !memberReturn
          ? returnTo
          : staff.role === "security"
            ? "/checkins/scan"
            : "/dashboard",
        url,
      ),
    );
  }
  const { data: linked, error: linkedError } = await admin
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (linkedError) return fail();
  let memberId: string | undefined = linked?.id;
  if (!memberId) {
    const email = String(user.email || "").toLowerCase();
    // Claiming an existing staff-created identity requires verified email ownership.
    if (!user.email_confirmed_at || !email) return fail();
    const { data: existing, error } = await admin
      .from("members")
      .select("id, user_id")
      .eq("email", email)
      .maybeSingle();
    if (error || (existing?.user_id && existing.user_id !== user.id))
      return fail();
    if (existing) {
      const { data: claimed, error: claimError } = await admin
        .from("members")
        .update({ user_id: user.id })
        .eq("id", existing.id)
        .is("user_id", null)
        .select("id")
        .maybeSingle();
      if (claimError || !claimed) return fail();
      memberId = claimed.id;
    } else {
      const { data: created, error: createError } = await admin
        .from("members")
        .upsert(
          {
            user_id: user.id,
            email,
            full_name: String(user.user_metadata?.full_name || "Member").slice(
              0,
              120,
            ),
            phone: "",
          },
          { onConflict: "user_id", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
      if (createError) return fail();
      if (created) memberId = created.id;
      else {
        const { data } = await admin
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        memberId = data?.id;
      }
    }
  }
  if (!memberId) return fail();
  const { data: free, error: planError } = await admin
    .from("membership_plans")
    .select("id")
    .eq("code", "rewards_free")
    .single();
  if (planError || !free) return fail();
  // Never replace an existing membership or paid access on repeat sign-in/signup.
  const { error } = await admin.from("memberships").upsert(
    {
      member_id: memberId,
      plan_id: free.id,
      status: "active",
      start_date: jamaicaTodayYmd(),
      paid_through_date: null,
    },
    { onConflict: "member_id", ignoreDuplicates: true },
  );
  if (error) return fail();
  return NextResponse.redirect(
    new URL(returnTo && memberReturn ? returnTo : "/member/start", url),
  );
}
