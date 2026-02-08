import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/return-to";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  // We support both:
  // 1) PKCE magic link / OAuth-style: ?code=...
  // 2) Email OTP verify style: ?token_hash=...&type=...

  const code = sp.get("code");
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;

  // Support returnTo (our app) and next (supabase templates sometimes use this)
  const returnTo = safeReturnTo(sp.get("returnTo"));
  const next = safeReturnTo(sp.get("next"));

  const finalReturnTo = returnTo || next || "";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }

    // Route through post-login so we land staff on /dashboard and members on /member
    redirect(
      finalReturnTo
        ? `/auth/post-login?returnTo=${encodeURIComponent(finalReturnTo)}`
        : "/auth/post-login"
    );
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (error) {
      redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
    }

    redirect(
      finalReturnTo
        ? `/auth/post-login?returnTo=${encodeURIComponent(finalReturnTo)}`
        : "/auth/post-login"
    );
  }

  redirect(`/auth/error?error=${encodeURIComponent("Missing code or token_hash/type")}`);
}
