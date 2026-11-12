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
  if (!raw) {
    const keyId = process.env.FYGARO_WEBHOOK_KEY_ID;
    const secret = process.env.FYGARO_WEBHOOK_SECRET;
    return keyId && secret ? { [keyId]: secret } : null;
  }
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj as Record<string, string>;
  } catch {
    return null;
  }
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
  const customReference = String(payload?.customReference || "");
  const amount = Number(payload?.amount);
  const currency = String(payload?.currency || "").toUpperCase();
  if (
    !transactionId ||
    !/^[0-9a-f-]{36}$/i.test(customReference) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    return new NextResponse("Invalid payment details", { status: 400 });
  }
  const { error } = await createAdminClient().rpc("fulfil_access_payment", {
    p_payment_id: customReference,
    p_transaction_id: transactionId,
    p_reference: String(payload?.reference || transactionId),
    p_amount: amount,
    p_currency: currency,
  });
  if (error) {
    // Non-2xx keeps fulfilment retryable. Do not acknowledge a lost entitlement.
    console.error("Payment fulfilment failed", {
      paymentId: customReference,
      code: error.code,
    });
    return new NextResponse(
      "Payment could not be fulfilled; reconciliation required",
      { status: 503 },
    );
  }
  return new NextResponse("OK", { status: 200 });
}
