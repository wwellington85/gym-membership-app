import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function escapeCsv(value: any) {
  const s = String(value ?? "");
  // Escape quotes and wrap if needed
  const needsWrap = /[",\n\r]/.test(s);
  const escaped = s.replace(/"/g, '""');
  return needsWrap ? `"${escaped}"` : escaped;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? "").trim();
  const to = (url.searchParams.get("to") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const method = (url.searchParams.get("method") ?? "").trim();

  const supabase = await createClient();

  // Auth guard (staff only)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: staffProfile, error: staffErr } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staffErr || !staffProfile) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Fetch payments in date range + method, then apply q filter in JS (same approach as UI)
  let query = supabase
    .from("payments")
    .select(
      "id, paid_on, amount, payment_method, notes, created_at, member:members(id, full_name, phone)"
    )
    .order("paid_on", { ascending: false })
    .limit(5000);

  if (from) query = query.gte("paid_on", from);
  if (to) query = query.lte("paid_on", to);
  if (method) query = query.eq("payment_method", method);

  const { data: rows, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const filtered = (rows ?? []).filter((r: any) => {
    if (!q) return true;
    const name = String(r.member?.full_name ?? "").toLowerCase();
    const phone = String(r.member?.phone ?? "").toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  // Build CSV
  const header = [
    "paid_on",
    "amount",
    "payment_method",
    "member_name",
    "member_phone",
    "notes",
  ];

  const lines = [
    header.join(","),
    ...filtered.map((r: any) =>
      [
        escapeCsv(r.paid_on),
        escapeCsv(Number(r.amount ?? 0).toFixed(2)),
        escapeCsv(r.payment_method),
        escapeCsv(r.member?.full_name),
        escapeCsv(r.member?.phone),
        escapeCsv(r.notes),
      ].join(",")
    ),
  ];

  const csv = lines.join("\n");

  const safeFrom = from || "all";
  const safeTo = to || "all";
  const filename = `payments_${safeFrom}_to_${safeTo}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
