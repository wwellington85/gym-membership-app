import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/return-to";
import { type EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  const code = sp.get("code");
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;

  // allow both next + returnTo
  const nextRaw = sp.get("next") ?? sp.get("returnTo") ?? "";
  const next = safeReturnTo(nextRaw) || "/auth/post-login";

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
