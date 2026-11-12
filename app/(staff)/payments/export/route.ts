import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
function csv(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Not authenticated", { status: 401 });
  const { data: staff } = await supabase
    .from("staff_profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (
    !staff ||
    staff.is_active === false ||
    !["admin", "front_desk"].includes(staff.role)
  )
    return new NextResponse("Not authorised", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const { data, error } = await createAdminClient().rpc(
    "search_club_payments",
    {
      p_query: (sp.get("q") || "").slice(0, 120),
      p_status: sp.get("status") || "all",
      p_from: sp.get("from") || null,
      p_to: sp.get("to") || null,
      p_page: 0,
      p_size: 5000,
    },
  );
  if (error)
    return new NextResponse("Could not export payments. Check filters.", {
      status: 400,
    });
  const fields = [
    "id",
    "full_name",
    "amount",
    "currency",
    "status",
    "payment_method",
    "created_at",
    "fulfilled_at",
  ];
  const output = [
    fields.join(","),
    ...(data || []).map((row: Record<string, unknown>) =>
      fields.map((f) => csv(row[f])).join(","),
    ),
  ].join("\r\n");
  return new NextResponse(output, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="travellers-payments.csv"',
      "Cache-Control": "no-store",
    },
  });
}
