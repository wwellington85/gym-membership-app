import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { googleReturnTo, googleSignInEnabled } from "@/lib/auth/google";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const failure = new URL("/auth/login", url);
  if (!googleSignInEnabled()) {
    failure.searchParams.set(
      "err",
      "Google sign-in is not available yet. Please continue with email.",
    );
    return NextResponse.redirect(failure);
  }
  const callback = new URL("/auth/google/callback", url);
  const returnTo = googleReturnTo(url.searchParams.get("returnTo"));
  if (returnTo) callback.searchParams.set("returnTo", returnTo);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (!error && data.url) return NextResponse.redirect(data.url);
  failure.searchParams.set(
    "err",
    "Google sign-in could not start. Try again or continue with email.",
  );
  return NextResponse.redirect(failure);
}
