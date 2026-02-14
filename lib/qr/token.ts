import crypto from "crypto";

function b64url(buf: Buffer) {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlToBuf(s: string) {
  const pad = 4 - (s.length % 4 || 4);
  const b64 = (s + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64");
}

export type QrClaims = {
  mid: string; // member id
  iat: number;
  exp: number;
  jti: string; // random id
};

export function signQrToken(claims: QrClaims, secret: string) {
  const payload = b64url(Buffer.from(JSON.stringify(claims), "utf8"));
  const sig = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifyQrToken(token: string, secret: string): { ok: true; claims: QrClaims } | { ok: false; reason: string } {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return { ok: false, reason: "bad_format" };

  const [payloadB64, sigB64] = parts;

  const expected = b64url(crypto.createHmac("sha256", secret).update(payloadB64).digest());
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false, reason: "bad_sig" };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "bad_sig" };

  let claims: any;
  try {
    claims = JSON.parse(b64urlToBuf(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!claims?.mid || !claims?.exp) return { ok: false, reason: "missing_claims" };
  if (now > Number(claims.exp)) return { ok: false, reason: "expired" };

  return { ok: true, claims };
}
