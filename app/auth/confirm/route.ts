import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/return-to";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sp = url.searchParams;

  // We support both `returnTo` (our app) and `next` (supabase starter pattern)
  const returnTo = safeReturnTo(sp.get("returnTo") || sp.get("next")) || "";

  const code = sp.get("code");
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  // PKCE flow (most common for magic links)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const dest = returnTo
        ? `/auth/post-login?returnTo=${encodeURIComponent(returnTo)}`
        : "/auth/post-login";
      redirect(dest);
    }
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  // token_hash flow (older/alternate)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      const dest = returnTo
        ? `/auth/post-login?returnTo=${encodeURIComponent(returnTo)}`
        : "/auth/post-login";
      redirect(dest);
    }
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/error?error=${encodeURIComponent("Missing code or token_hash/type")}`);
}
