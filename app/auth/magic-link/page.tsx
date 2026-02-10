"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeReturnTo } from "@/lib/auth/return-to";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function isValidEmail(v: string) {
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function MagicLinkPage() {
  const returnToRaw = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("returnTo");
    return v ? String(v) : "";
  }, []);

  const returnTo = useMemo(() => safeReturnTo(returnToRaw), [returnToRaw]);
  
  useEffect(() => {
    const applyFromUrl = () => {
      try {
        const v = new URLSearchParams(window.location.search).get("email");
        if (v) setEmail(String(v));
      } catch {
        // ignore
      }
    };

    applyFromUrl();

    // Handle client-side nav/back/forward where the component might not remount
    const onPop = () => applyFromUrl();
    window.addEventListener("popstate", onPop);

    return () => window.removeEventListener("popstate", onPop);
  }, []);
const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = isValidEmail(email);
  const loginHref = returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : "/auth/login";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    if (!isValidEmail(cleanEmail)) {
      setError("Enter a valid email to receive a login link.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();

      const origin =
        (typeof window !== "undefined"
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL || "")
        ).replace(/\/$/, "");

      // Important: send users back through /auth/confirm, which then redirects to /auth/post-login.
      const confirmUrl = `${origin}/auth/confirm${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: confirmUrl },
      });

      if (otpErr) throw otpErr;

      // UX: return to login with a success banner
      const u = new URL(loginHref, window.location.origin);
      u.searchParams.set("sent", "magic");
      u.searchParams.set("email", cleanEmail);
      if (returnTo) u.searchParams.set("returnTo", returnTo);
      window.location.assign(u.toString());
      return;
    } catch (err: any) {
      setError(err?.message || "Could not send login link");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Email me a login link</CardTitle>
          <CardDescription>
            We’ll send a secure link to your inbox. Clicking it verifies you own the email.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {<form onSubmit={handleSend} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              {error ? <p className="text-sm text-red-500">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={isLoading || !emailOk}>
                {isLoading ? "Sending..." : "Send magic link"}
              </Button>

              <div className="text-center text-sm">
                Prefer password?{" "}
                <Link className="underline underline-offset-4" href={loginHref}>
                  Login with password
                </Link>
              </div>
            </form>}
        </CardContent>
      </Card>
    </div>
  );
}
