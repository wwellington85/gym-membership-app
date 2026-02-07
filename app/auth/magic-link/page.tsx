"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeReturnTo } from "@/lib/auth/return-to";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MagicLinkPage() {
  const returnToRaw = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("returnTo");
    return v ? String(v) : "";
  }, []);

  const returnTo = useMemo(() => safeReturnTo(returnToRaw), [returnToRaw]);

  const initialEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("email");
    return v ? String(v) : "";
  }, []);

  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginHref = returnTo
    ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}`
    : "/auth/login";

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const origin = (
        process.env.NEXT_PUBLIC_SITE_URL ||
        (typeof window !== "undefined" ? window.location.origin : "")
      ).replace(/\/$/, "");

      const redirectTo = `${origin}/auth/confirm${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;

      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });

      if (otpErr) throw otpErr;
      setSent(true);
    } catch (err: any) {
      setError(err?.message || "Could not send magic link");
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
            We’ll send a secure magic link to your inbox. Clicking it verifies you own the email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3">
              <div className="rounded border p-3 text-sm">
                Link sent. Please check your email (and spam/junk).
              </div>
              <Link className="underline underline-offset-4" href={loginHref}>
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              {error ? <p className="text-sm text-red-500">{error}</p> : null}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send magic link"}
              </Button>

              <div className="text-center text-sm">
                Prefer password?{" "}
                <Link className="underline underline-offset-4" href={loginHref}>
                  Login with password
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
