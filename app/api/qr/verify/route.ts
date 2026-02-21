import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyQrToken } from "@/lib/qr/token";
import { isAccessActiveAtJamaicaCutoff } from "@/lib/membership/status";

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
    .select("status, start_date, paid_through_date, membership_plans(code, name, duration_days)")
    .eq("member_id", member.id)
    .order("start_date", { ascending: false })
    .maybeSingle();

  const planRaw: any = (membership as any)?.membership_plans;
  const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
  const activeNow = isAccessActiveAtJamaicaCutoff({
    status: (membership as any)?.status ?? null,
    startDate: (membership as any)?.start_date ?? null,
    paidThroughDate: (membership as any)?.paid_through_date ?? null,
    durationDays: plan?.duration_days ?? null,
  });

  return NextResponse.json({
    ok: true,
    member,
    membership,
    active_now: activeNow,
    exp: v.claims.exp,
  });
}
