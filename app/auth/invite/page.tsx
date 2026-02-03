import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();

  // Supabase email links commonly include either:
  // - code=... (PKCE flow) -> exchangeCodeForSession
  // - or token_hash/type (older flow)
  const code = typeof searchParams.code === "string" ? searchParams.code : null;
  const token_hash =
    typeof searchParams.token_hash === "string" ? searchParams.token_hash : null;
  const type = typeof searchParams.type === "string" ? searchParams.type : null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(`/login?err=${encodeURIComponent(error.message)}`);
    }
    redirect("/auth/update-password");
  }

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash,
    });
    if (error) {
      redirect(`/login?err=${encodeURIComponent(error.message)}`);
    }
    redirect("/auth/update-password");
  }

  // If we get here, the link is missing required params
  redirect("/login?err=Invalid%20invite%20link");
}
