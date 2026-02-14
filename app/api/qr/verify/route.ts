import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQrToken } from "@/lib/qr/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.QR_TOKEN_SECRET || "";
  if (!secret) return new NextResponse("Missing QR_TOKEN_SECRET", { status: 500 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return new NextResponse("Bad JSON", { status: 400 });
  }

  const token = String(body?.token || "").trim();
  if (!token) return new NextResponse("Missing token", { status: 400 });

  const v = verifyQrToken(token, secret);
  if (!v.ok) return NextResponse.json({ ok: false, reason: v.reason }, { status: 400 });

  const supabase = createAdminClient();

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone, email")
    .eq("id", v.claims.mid)
    .maybeSingle();

  if (!member?.id) return NextResponse.json({ ok: false, reason: "member_not_found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("memberships")
    .select("status, paid_through_date, membership_plans(code, name)")
    .eq("member_id", member.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    member,
    membership,
    exp: v.claims.exp,
  });
}
