"use client";



function isValidEmail(v: string) {
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { safeReturnTo } from "@/lib/auth/return-to";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const initialEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("email");
    return v ? String(v) : "";
  }, []);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sentType = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("sent") || "";
  }, []);

  const [showSent, setShowSent] = useState(() => {
    return sentType !== "";
  });
// Avoid useSearchParams() here to prevent Suspense CSR bailout issues.
  const returnToRaw = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("returnTo");
    return v ? String(v) : "";
  }, []);

  const returnTo = useMemo(() => safeReturnTo(returnToRaw), [returnToRaw]);

  

  

  const emailOk = useMemo(() => isValidEmail(email), [email]);

  const magicHref = useMemo(() => {
    const clean = email.trim();
    if (!isValidEmail(clean)) return "";
    return returnTo
      ? `/auth/magic-link?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(clean)}`
      : `/auth/magic-link?email=${encodeURIComponent(clean)}`;
  }, [email, returnTo]);

const handleMagicLinkClick = useCallback(
    (e: React.MouseEvent) => {
      const v = (email || "").trim();
      // Basic email check (just to avoid empty/obvious bad clicks)
      if (!v || !v.includes("@")) {
        e.preventDefault();
        setError("Enter a valid email to receive a login link.");
      }
    },
    [email]
  );

  const errMsg = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("err");
    return v ? String(v) : "";
  }, []);


  const sentMsg = useMemo(() => {
    if (!sentType) return "";
    if (sentType === "1") return "Password reset email sent. Please check your inbox.";
    if (sentType === "magic") return "Login link sent. Please check your email (and spam/junk).";
    return "";
  }, [sentType]);
useEffect(() => {
    if (!showSent) return;

    const t = window.setTimeout(() => {
      setShowSent(false);

      // Remove sent=1 from URL so refresh doesn't show the banner again
      const url = new URL(window.location.href);
      url.searchParams.delete("sent");
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));
    }, 3500);

    return () => window.clearTimeout(t);
  }, [showSent]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      // Pull tokens from the client session and sync to server cookies (SSR/middleware relies on cookies).
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const sess = sessionRes?.session;
      if (!sess?.access_token || !sess?.refresh_token) {
        throw new Error("Login succeeded but session was missing. Please try again.");
      }

      const syncRes = await fetch("/auth/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token: sess.access_token,
          refresh_token: sess.refresh_token,
        }),
      });

      if (!syncRes.ok) {
        const j = await syncRes.json().catch(() => ({}));
        throw new Error(j?.error || "Could not sync session.");
      }

      // Ensure the session is persisted before we hit a server route that relies on cookies.
      await supabase.auth.getSession();

      // Let the server decide where to send the user (staff vs member) safely.
      window.location.assign(returnTo ? `/auth/post-login?returnTo=${encodeURIComponent(returnTo)}` : "/auth/post-login");
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot your password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div className="text-xs opacity-70">
                  {emailOk && magicHref ? (
                    <Link href={magicHref} onClick={handleMagicLinkClick}
                    className="underline underline-offset-4">
                      Email me a login link instead
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed opacity-50">
                      Email me a login link instead
                    </span>
                  )}
                  {!emailOk ? (
                    <span className="ml-2 text-xs opacity-60">Enter your email first</span>
                  ) : null}
                </div>
              </div>

              {showSent && sentMsg && <p className="text-sm text-green-600">{sentMsg}</p>}
              {errMsg && <p className="text-sm text-red-500">{errMsg}</p>}
              {error && <p className="text-sm text-red-500">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>

            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/join" className="underline underline-offset-4">
                Join Travellers Club
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
