import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  const supabase = createClient();

  // Newer Supabase email links (PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?err=${encodeURIComponent(error.message)}`, url)
      );
    }
    return NextResponse.redirect(new URL("/auth/update-password", url));
  }

  // Older style links
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });
    if (error) {
      return NextResponse.redirect(
        new URL(`/login?err=${encodeURIComponent(error.message)}`, url)
      );
    }
    return NextResponse.redirect(new URL("/auth/update-password", url));
  }

  return NextResponse.redirect(new URL("/login?err=Invalid%20invite%20link", url));
}
