import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { signQrToken, type QrClaims } from "@/lib/qr/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function randId() {
  return crypto.randomBytes(16).toString("hex");
}

async function issueToken() {
  const secret = process.env.QR_TOKEN_SECRET || "";
  if (!secret) {
    return NextResponse.json({ ok: false, error: "Missing QR_TOKEN_SECRET" }, { status: 500 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member?.id) {
    return NextResponse.json({ ok: false, error: "Member not found" }, { status: 404 });
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.QR_TOKEN_TTL_SECONDS || 45); // short-lived prevents screenshot sharing
  const claims: QrClaims = {
    mid: member.id,
    iat: now,
    exp: now + (ttl > 10 ? ttl : 45),
    jti: randId(),
  } as any;

  // python doesn't know TS ternary; keep logic simple by generating after
  claims.exp = now + (ttl > 10 ? ttl : 45)

  const token = signQrToken(claims, secret);
  return NextResponse.json({ ok: true, token, exp: claims.exp });
}

export async function GET() {
  return issueToken();
}

export async function POST() {
  return issueToken();
}
