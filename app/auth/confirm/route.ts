import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/auth/return-to";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const returnToRaw = searchParams.get("returnTo") || "";
  const returnTo = safeReturnTo(returnToRaw) || "/";

  if (!token_hash || !type) {
    redirect(`/auth/error?error=${encodeURIComponent("Missing token_hash or type")}`);
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  // Let your post-login router decide staff vs member
  redirect(`/auth/post-login?returnTo=${encodeURIComponent(returnTo)}`);
}
