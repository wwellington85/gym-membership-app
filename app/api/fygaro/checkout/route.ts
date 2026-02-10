import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signHS256(header: any, payload: any, secret: string) {
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const msg = `${h}.${p}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(msg)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${msg}.${sig}`;
}

function getOrigin(reqUrl: string) {
  const u = new URL(reqUrl);
  // Prefer NEXT_PUBLIC_SITE_URL if set; otherwise use the request origin.
  const env = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/$/, "");
  return env || u.origin;
}

export async function POST(req: Request) {
  const reqUrl = new URL(req.url);
  const planCode = String(reqUrl.searchParams.get("plan") || "").trim();
  if (!planCode) {
    return NextResponse.redirect(new URL("/member/upgrade?err=Missing+plan", reqUrl));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL("/auth/login", reqUrl));

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) return NextResponse.redirect(new URL("/join", reqUrl));

  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, code, name, price, duration_days, is_active")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();

  if (!plan) return NextResponse.redirect(new URL("/member/upgrade?err=Invalid+plan", reqUrl));

  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("member_id", member.id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.redirect(new URL("/member/upgrade?err=No+membership+row", reqUrl));
  }

  const origin = getOrigin(req.url);

  // Return URL (backup). Recommended to set this in Fygaro button "Advanced Options" too.
  // This endpoint can show a friendly "Processing payment..." screen while webhook completes.
  const returnUrl = `${origin}/api/fygaro/return`;

  // Create pending payment record (cash payments can also live in this table; just use provider=null or provider='cash')
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      membership_id: membership.id,
      member_id: member.id,
      amount: plan.price,
      currency: "USD", // match your Fygaro button currency; change to JMD if your button is JMD
      provider: "fygaro",
      status: "pending",
      provider_reference: plan.code,
      notes: `Plan=${plan.code}`,
      raw: { returnUrl },
    })
    .select("id")
    .single();

  if (payErr || !payment?.id) {
    return NextResponse.redirect(new URL("/member/upgrade?err=Payment+create+failed", reqUrl));
  }

  const buttonUrl = (process.env.FYGARO_BUTTON_URL || "").trim();
  const keyId = (process.env.FYGARO_API_KEY || "").trim();
  const secret = (process.env.FYGARO_API_SECRET || "").trim();

  if (!buttonUrl || !keyId || !secret) {
    return NextResponse.redirect(new URL("/member/upgrade?err=Missing+Fygaro+env", reqUrl));
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", kid: keyId };
  const payload = {
    amount: Number(plan.price).toFixed(2),
    currency: "USD",
    custom_reference: payment.id, // returns as customReference in hook payload
    exp: now + 60 * 30, // 30 min
    nbf: now - 5,
  };

  const jwt = signHS256(header, payload, secret);

  const url = new URL(buttonUrl);
  url.searchParams.set("jwt", jwt);

  // FYI: Many Fygaro setups use the button's configured Return URL (recommended).
  // If Fygaro supports passing it via query for your button type, you could try:
  // url.searchParams.set("return_url", returnUrl);

  return NextResponse.redirect(url.toString());
}
