import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/return-to";
import { type EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

function getSupabaseVerifyUrl(requestUrl: URL) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    return new URL("/auth/v1/verify", supabaseUrl);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  const code = sp.get("code");
  const token = sp.get("token");
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;
  const confirmationUrlRaw = sp.get("confirmation_url");

  // allow both next + returnTo
  const nextRaw = sp.get("next") ?? sp.get("returnTo") ?? "";
  const next = safeReturnTo(nextRaw) || "/auth/post-login";

  // Some custom Supabase templates pass the full verification URL through
  // instead of linking to it directly. Accept that and hand off safely.
  if (confirmationUrlRaw) {
    try {
      const confirmationUrl = new URL(confirmationUrlRaw);
      const verifyUrl = getSupabaseVerifyUrl(url);

      if (
        verifyUrl &&
        confirmationUrl.origin === verifyUrl.origin &&
        confirmationUrl.pathname === verifyUrl.pathname
      ) {
        return NextResponse.redirect(confirmationUrl);
      }
    } catch {
      // fall through to normal auth handling below
    }
  }

  // Some templates also hit /auth/confirm with token + type. Redirect those
  // back to Supabase's verify endpoint so the rest of the flow still works.
  if (token && type) {
    const verifyUrl = getSupabaseVerifyUrl(url);
    if (verifyUrl) {
      verifyUrl.searchParams.set("token", token);
      verifyUrl.searchParams.set("type", type);
      verifyUrl.searchParams.set(
        "redirect_to",
        sp.get("redirect_to") ??
          `${url.origin}/auth/confirm${nextRaw ? `?next=${encodeURIComponent(nextRaw)}` : ""}`
      );
      return NextResponse.redirect(verifyUrl);
    }
  }

  const supabase = await createClient();

  // PKCE flow (common modern magic link flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url));
    }
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, url)
    );
  }

  // OTP token_hash flow (legacy)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, url));
    }
    return NextResponse.redirect(
      new URL(`/auth/error?error=${encodeURIComponent(error.message)}`, url)
    );
  }

  // Helpful debug so we can see what params actually arrived
  const debug = encodeURIComponent(url.search || "(no query string)");
  return NextResponse.redirect(
    new URL(`/auth/error?error=${encodeURIComponent("Missing code or token_hash/type")}&debug=${debug}`, url)
  );
}
