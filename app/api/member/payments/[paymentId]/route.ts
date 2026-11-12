import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in again." },
      { status: 401 },
    );
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  const { paymentId } = await params;
  if (!member || !/^[0-9a-f-]{36}$/i.test(paymentId))
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  const { data: payment, error } = await admin
    .from("payments")
    .select(
      "id, status, amount, currency, fulfilled_at, access_start_date, access_end_date",
    )
    .eq("id", paymentId)
    .eq("member_id", member.id)
    .maybeSingle();
  if (error)
    return NextResponse.json(
      { error: "Payment status is temporarily unavailable." },
      { status: 503 },
    );
  if (!payment)
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  return NextResponse.json(payment, {
    headers: { "Cache-Control": "no-store" },
  });
}
