import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQrToken } from "@/lib/qr/token";
import { loadAccess } from "@/lib/access/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    !staff ||
    staff.is_active === false ||
    !["admin", "front_desk", "security"].includes(staff.role)
  )
    return NextResponse.json({ error: "Not authorised" }, { status: 403 });
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "QR verification unavailable" },
      { status: 503 },
    );
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const result = verifyQrToken(String(body?.token || ""), secret);
  if (!result.ok)
    return NextResponse.json(
      { ok: false, reason: result.reason },
      { status: 400 },
    );
  const { data: member } = await createAdminClient()
    .from("members")
    .select("id, full_name, is_active")
    .eq("id", result.claims.mid)
    .maybeSingle();
  if (!member)
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  try {
    const access = await loadAccess(member.id, member.is_active);
    return NextResponse.json(
      {
        ok: true,
        member,
        gym_access: access.gym,
        resort_access: access.resort,
        exp: result.claims.exp,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Access cannot be verified right now" },
      { status: 503 },
    );
  }
}
