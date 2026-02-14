import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function base64url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signHS256(header: Record<string, any>, payload: Record<string, any>, secret: string) {
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

function redirectUpgrade(reqUrl: string, planCode: string, err: string) {
  const u = new URL("/member/upgrade", reqUrl);
  if (planCode) u.searchParams.set("plan", planCode);
  if (err) u.searchParams.set("err", err);
  return NextResponse.redirect(u, 303);
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  // Prefer querystring, but also accept POST body (hidden input)
  let planCode = String(url.searchParams.get("plan") || "").trim();
  if (!planCode) {
    try {
      const fd = await req.formData();
      planCode = String(fd.get("plan") || fd.get("plan_code") || "").trim();
    } catch {
      // ignore
    }
  }

  if (!planCode) {
    return redirectUpgrade(req.url, "", "Missing plan");
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;

  if (!user) {
    return NextResponse.redirect(new URL("/auth/login", req.url), 303);
  }

  const { data: member, error: memberErr } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberErr) console.error("checkout: members lookup error", memberErr);

  if (!member?.id) {
    return NextResponse.redirect(new URL("/join", req.url));
  }

  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("id, code, name, price, duration_days, is_active")
    .eq("code", planCode)
    .eq("is_active", true)
    .maybeSingle();

  if (planErr) console.error("checkout: plan lookup error", planErr);

  if (!plan?.id) {
    return redirectUpgrade(req.url, planCode, "Invalid plan");
  }

  if (plan.code === "rewards_free") {
    return redirectUpgrade(req.url, planCode, "Free plan does not require payment");
  }

  const { data: membership, error: msErr } = await supabase
    .from("memberships")
    .select("id")
    .eq("member_id", member.id)
    .maybeSingle();

  if (msErr) console.error("checkout: memberships lookup error", msErr);

  if (!membership?.id) {
    return redirectUpgrade(req.url, planCode, "No membership row");
  }

  // Create pending payment record
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      membership_id: membership.id,
      member_id: member.id,
      amount: plan.price,
      currency: "USD",
      provider: "fygaro",
      status: "pending",
      provider_reference: plan.code,
      notes: `Plan=${plan.code}`,
    })
    .select("id")
    .single();

  if (payErr) console.error("checkout: payments insert error", payErr);

  if (!payment?.id) {
    const msg =
      (payErr as any)?.message ? String((payErr as any).message) : "Payment create failed";
    return redirectUpgrade(req.url, planCode, msg);
  }

  const buttonUrl = process.env.FYGARO_BUTTON_URL || "";
  const keyId = process.env.FYGARO_API_KEY || "";
  const secret = process.env.FYGARO_API_SECRET || "";

  if (!buttonUrl || !keyId || !secret) {
    return redirectUpgrade(req.url, planCode, "Missing Fygaro env");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", kid: keyId };
  const payload = {
    amount: Number(plan.price).toFixed(2),
    currency: "USD",
    custom_reference: payment.id,
    exp: now + 60 * 30,
    nbf: now - 5,
  };

  const jwt = signHS256(header, payload, secret);

  const fyUrl = new URL(buttonUrl);
  fyUrl.searchParams.set("jwt", jwt);

    const checkoutUrl = new URL("/member/checkout", req.url);
  checkoutUrl.searchParams.set("payment", String(payment.id));
  return NextResponse.redirect(checkoutUrl, 303);
}
