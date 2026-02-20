import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const identifierRaw = String(body?.identifier ?? "").trim().toLowerCase();
    if (!identifierRaw) {
      return NextResponse.json({ email: null }, { status: 200 });
    }

    // Email login path remains direct.
    if (identifierRaw.includes("@")) {
      return NextResponse.json({ email: identifierRaw }, { status: 200 });
    }

    const admin = createAdminClient();
    const { data } = await admin
      .from("staff_profiles")
      .select("email, is_active")
      .eq("username", identifierRaw)
      .maybeSingle();

    if (!data || data.is_active === false || !data.email) {
      // Keep response generic to avoid enumeration.
      return NextResponse.json({ email: null }, { status: 200 });
    }

    return NextResponse.json({ email: String(data.email).toLowerCase() }, { status: 200 });
  } catch {
    return NextResponse.json({ email: null }, { status: 200 });
  }
}
