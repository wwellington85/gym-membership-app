import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signQrToken } from "@/lib/qr/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.QR_TOKEN_SECRET || "";
  if (!secret) return new NextResponse("Missing QR_TOKEN_SECRET", { status: 500 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member?.id) return new NextResponse("No member", { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  const ttl = 45; // seconds (rotates fast enough to kill screenshots)
  const claims = {
    mid: member.id,
    iat: now,
    exp: now + ttl,
    jti: crypto.randomBytes(8).toString("hex"),
  };

  const token = signQrToken(claims, secret);
  return NextResponse.json({ token, exp: claims.exp, ttl });
}
