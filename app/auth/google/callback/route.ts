import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googlePostLoginPath, googleSignInEnabled } from "@/lib/auth/google";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (googleSignInEnabled() && code && !url.searchParams.has("error")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(googlePostLoginPath(url.searchParams.get("returnTo")), url),
      );
    }
  }
  const failure = new URL("/auth/login", url);
  failure.searchParams.set(
    "err",
    "Google sign-in was not completed. Please try again or continue with email in this app.",
  );
  return NextResponse.redirect(failure);
}
