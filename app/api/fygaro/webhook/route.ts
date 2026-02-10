import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseSigHeader(sig: string) {
  // Example: "t=1700000000,v1=abc,v1=def"
  const parts = sig
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let t: string | null = null;
  const v1: string[] = [];

  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (k === "t") t = v;
    if (k === "v1") v1.push(v);
  }

  return { t, v1 };
}

function safeEqualHex(aHex: string, bHex: string) {
  try {
    const a = Buffer.from(aHex, "hex");
    const b = Buffer.from(bHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getSecretsMap() {
  // FYGARO_HOOK_SECRETS should be JSON like: {"<keyId>":"<secret>", "<keyId2>":"<secret2>"}
  const raw = process.env.FYGARO_HOOK_SECRETS || "";
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj as Record<string, string>;
  } catch {
    return null;
  }
}

function isoDateUTC(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDaysISO(baseISO: string, days: number) {
  // baseISO expected "YYYY-MM-DD"
  const base = new Date(`${baseISO}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return isoDateUTC(base);
}

export async function POST(req: Request) {
  const keyId =
    req.headers.get("fygaro-key-id") ||
    req.headers.get("Fygaro-Key-Id") ||
    req.headers.get("Fygaro-Key-ID") ||
    "";

  const sigHdr =
    req.headers.get("fygaro-signature") ||
    req.headers.get("Fygaro-Signature") ||
    "";

  if (!keyId || !sigHdr) {
    return new NextResponse("Missing Fygaro headers", { status: 400 });
  }

  const secrets = getSecretsMap();
  const secret = secrets?.[keyId];

  if (!secret) {
    return new NextResponse("Unknown key id", { status: 400 });
  }

  // Read RAW bytes (correct for signature validation)
  const rawBuf = Buffer.from(await req.arrayBuffer());
  const rawBody = rawBuf.toString("utf8"); // only for JSON parsing after signature passes

  const { t, v1 } = parseSigHeader(sigHdr);

  if (!t || !v1.length) {
    return new NextResponse("Malformed signature header", { status: 400 });
  }

  const ts = Number(t);
  if (!Number.isFinite(ts)) {
    return new NextResponse("Bad timestamp", { status: 400 });
  }

  // Basic replay protection: ±5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    return new NextResponse("Stale timestamp", { status: 400 });
  }

  // message = t + "." + raw_body_bytes
  const prefix = Buffer.from(`${t}.`, "utf8");
  const message = Buffer.concat([prefix, rawBuf]);

  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  const ok = v1.some((h) => safeEqualHex(expectedHex, h));
  if (!ok) {
    return new NextResponse("Invalid signature", { status: 400 });
  }

  // Signature verified. Now process JSON.
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const transactionId = String(payload?.transactionId || "");
  const fygaroRef = String(payload?.reference || "");
  const customReference = String(payload?.customReference || "");
  const amount = payload?.amount != null ? String(payload.amount) : null;
  const currency = payload?.currency != null ? String(payload.currency) : null;

  if (!customReference) {
    return new NextResponse("Missing customReference", { status: 400 });
  }

  const supabase = createAdminClient();

  // 1) Load payment row
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("id, status, membership_id, member_id, provider_reference, amount, currency, provider, provider_payment_id")
    .eq("id", customReference)
    .maybeSingle();

  if (payErr || !payment) {
    return new NextResponse("Payment not found", { status: 400 });
  }

  // Idempotency: if already paid, return 200 quickly
  if (String(payment.status || "").toLowerCase() === "paid") {
    return new NextResponse("OK", { status: 200 });
  }

  // 2) Mark payment as paid + store provider ids + raw payload
  // If Fygaro retries the webhook, this should still be safe.
  const todayISO = isoDateUTC(new Date());

  const { error: updPayErr } = await supabase
    .from("payments")
    .update({
      status: "paid",
      provider: "fygaro",
      provider_payment_id: transactionId || payment.provider_payment_id || null,
      provider_reference: fygaroRef || payment.provider_reference || null,
      currency: currency || payment.currency || null,
      amount: amount != null ? Number(amount) : payment.amount,
      raw: payload,
      paid_on: todayISO,
      payment_method: "fygaro",
    })
    .eq("id", payment.id);

  if (updPayErr) {
    // If the unique index (provider, provider_payment_id) triggers on retry, treat as delivered.
    // You can optionally inspect updPayErr.code here, but returning 200 prevents endless retries.
    return new NextResponse("OK", { status: 200 });
  }

  // 3) Determine plan from payment.provider_reference (we store plan code there from checkout)
  const planCode = String(payment.provider_reference || "").trim();
  if (!planCode) {
    return new NextResponse("OK", { status: 200 });
  }

  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, code, duration_days")
    .eq("code", planCode)
    .maybeSingle();

  if (!plan) {
    return new NextResponse("OK", { status: 200 });
  }

  // 4) Extend membership dates
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, paid_through_date")
    .eq("id", payment.membership_id)
    .maybeSingle();

  if (!membership) {
    return new NextResponse("OK", { status: 200 });
  }

  // If paid_through_date exists and is >= today, extend from it; otherwise start from today.
  const current = membership.paid_through_date ? String(membership.paid_through_date) : "";
  const baseISO = current && current >= todayISO ? current : todayISO;

  const durationDays = Number(plan.duration_days || 0);
  const newPaidThroughISO = addDaysISO(baseISO, durationDays);

  await supabase
    .from("memberships")
    .update({
      plan_id: plan.id,
      status: "active",
      last_payment_date: todayISO,
      paid_through_date: newPaidThroughISO,
      updated_at: new Date().toISOString(),
    })
    .eq("id", membership.id);

  return new NextResponse("OK", { status: 200 });
}
