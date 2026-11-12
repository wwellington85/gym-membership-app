import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected)
    return new NextResponse("Maintenance is not configured", { status: 503 });
  const actual = req.headers.get("authorization") || "";
  const target = `Bearer ${expected}`;
  if (
    Buffer.byteLength(actual) !== Buffer.byteLength(target) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(target))
  )
    return new NextResponse("Not authorised", { status: 401 });
  const { data, error } = await createAdminClient().rpc(
    "apply_due_programme_updates",
  );
  if (error)
    return NextResponse.json(
      { error: "Programme updates could not be applied" },
      { status: 503 },
    );
  return NextResponse.json(
    { applied: data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
