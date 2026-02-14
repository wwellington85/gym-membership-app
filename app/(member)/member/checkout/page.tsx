import crypto from "crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
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

export default async function FygaroCheckoutPage(props: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const sp = await props.searchParams;
  const paymentId = String(sp.payment || "").trim();

  if (!paymentId) redirect("/member/settings?err=Missing%20payment%20reference");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member?.id) redirect("/join");

  const { data: payment } = await supabase
    .from("payments")
    .select("id, member_id, membership_id, amount, currency, status, provider, provider_reference")
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment?.id) redirect("/member/settings?err=Payment%20not%20found");
  if (payment.member_id !== member.id) redirect("/member/settings?err=Unauthorized%20payment");

  if (String(payment.provider || "") !== "fygaro") {
    redirect("/member/settings?err=Invalid%20payment%20provider");
  }

  const buttonUrl = process.env.FYGARO_BUTTON_URL || "";
  const keyId = process.env.FYGARO_API_KEY || "";
  const secret = process.env.FYGARO_API_SECRET || "";

  if (!buttonUrl || !keyId || !secret) {
    redirect("/member/settings?err=Missing%20Fygaro%20configuration");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", kid: keyId };

  const payload = {
    amount: Number(payment.amount || 0).toFixed(2),
    currency: String(payment.currency || "USD"),
    custom_reference: payment.id, // matches your webhook logic
    exp: now + 60 * 30,
    nbf: now - 5,
  };

  const jwt = signHS256(header, payload, secret);

  const fyUrl = new URL(buttonUrl);
  fyUrl.searchParams.set("jwt", jwt);

  // Try to keep the flow "in-app" by returning to our branded return page after payment.
  // Fygaro parameter names vary by product; we set a few common ones.
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  if (base) {
    const returnTo = new URL("/member/payment-return", base);
    returnTo.searchParams.set("customReference", String(payment.id));
    // Common param names used by gateways / hosted checkouts
    fyUrl.searchParams.set("return_url", returnTo.toString());
    fyUrl.searchParams.set("redirect_url", returnTo.toString());
    fyUrl.searchParams.set("callback_url", returnTo.toString());
  }


  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Secure checkout</h1>
          <div className="text-sm opacity-70">
            Amount: ${Number(payment.amount || 0).toFixed(2)} {payment.currency || "USD"}
          </div>
        </div>

        <Link
          href="/member/settings"
          className="rounded border px-3 py-2 text-sm hover:oura-surface-muted"
        >
          Cancel
        </Link>
      </div>
      <div className="oura-card p-4 space-y-3">
        <div className="text-sm opacity-70">
          You’ll be taken to our secure payment page to complete checkout.
        </div>

        <a
          href={fyUrl.toString()}
          className="block w-full rounded border px-3 py-3 text-center text-sm hover:oura-surface-muted"
        >
          Continue to secure payment
        </a>

        <div className="text-xs opacity-70">
          After payment, you’ll return here automatically.
        </div>
      </div>

      <div className="text-xs opacity-70">
        Having trouble? Try opening in your device browser.
      </div>
    </div>
  );
}
