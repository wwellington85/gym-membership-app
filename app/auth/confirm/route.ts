import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/return-to";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // Supabase may send either:
  // - ?code=... (PKCE)
  // - ?token_hash=...&type=... (OTP magic link)
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Prefer `next`, but allow `returnTo` for our own links
  const nextRaw = searchParams.get("next") ?? searchParams.get("returnTo") ?? "";
  const next = safeReturnTo(nextRaw) || "/auth/post-login";

  const supabase = await createClient();

  // PKCE flow (common for magic links now)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  // Legacy OTP flow
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) redirect(next);
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/error?error=${encodeURIComponent("Missing code or token_hash/type")}`);
}
