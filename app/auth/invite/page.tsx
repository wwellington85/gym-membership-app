"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LOGIN_PATH = "/auth/login"; // <-- change this if your app uses a different login route

function parseHashParams(hash: string) {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(h);
  return {
    access_token: params.get("access_token"),
    refresh_token: params.get("refresh_token"),
    expires_in: params.get("expires_in"),
    token_type: (params.get("token_type") || params.get("type")),
    error: params.get("error"),
    error_description: params.get("error_description"),
  };
}

export default function InviteHandlerPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const supabase = createClient();

      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        // Let the server route handler exchange the code and set cookies
        window.location.href = `/auth/invite/callback?code=${encodeURIComponent(code)}`;
        return;
      }

      const {
        access_token,
        refresh_token,
        error,
        error_description,
      } = parseHashParams(window.location.hash);

      if (error) {
        const msg = error_description || error;
        router.replace(`${LOGIN_PATH}?err=${encodeURIComponent(msg)}`);
        return;
      }

      // Hash-based invite flow
      if (access_token && refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (setErr) {
          router.replace(`${LOGIN_PATH}?err=${encodeURIComponent(setErr.message)}`);
          return;
        }
        router.replace("/auth/update-password");
        return;
      }

      // If there are no hash tokens, the server route.ts should have handled ?code=
      router.replace(`${LOGIN_PATH}?err=${encodeURIComponent("Invalid invite link")}`);
    };

    run();
  }, [router]);

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm rounded border p-4">
        <p className="text-sm">Preparing your account…</p>
      </div>
    </div>
  );
}
