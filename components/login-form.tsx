"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { safeReturnTo } from "@/lib/auth/return-to";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

function isValidEmail(v: string) {
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const initialEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("email");
    return v ? String(v) : "";
  }, []);

  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sentType = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("sent") || "";
  }, []);

  const [showSent, setShowSent] = useState(() => sentType !== "");

  // Avoid useSearchParams() here to prevent Suspense CSR bailout issues.
  const returnToRaw = useMemo(() => {
    if (typeof window === "undefined") return "";
    const v = new URLSearchParams(window.location.search).get("returnTo");
    return v ? String(v) : "";
  }, []);

  const returnTo = useMemo(() => safeReturnTo(returnToRaw), [returnToRaw]);

  const emailOk = useMemo(() => isValidEmail(identifier), [identifier]);

  const magicHref = useMemo(() => {
    const clean = identifier.trim();
    if (!isValidEmail(clean)) return "";
    return returnTo
      ? `/auth/magic-link?returnTo=${encodeURIComponent(returnTo)}&email=${encodeURIComponent(clean)}`
      : `/auth/magic-link?email=${encodeURIComponent(clean)}`;
  }, [identifier, returnTo]);

  const handleMagicLinkClick = useCallback(
    (e: React.MouseEvent) => {
      const v = (identifier || "").trim();
      if (!v || !v.includes("@")) {
        e.preventDefault();
        setError("Enter a valid email address to receive a login link.");
      }
    },
    [identifier]
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

      // Remove sent=... from URL so refresh doesn't show the banner again
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
      const rawIdentifier = identifier.trim().toLowerCase();
      let loginEmail = rawIdentifier;

      if (!rawIdentifier) {
        throw new Error("Enter your username or email.");
      }

      if (!rawIdentifier.includes("@")) {
        const resolved = await fetch("/api/auth/resolve-identifier", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ identifier: rawIdentifier }),
        }).then((r) => r.json()).catch(() => ({ email: null }));

        loginEmail = String(resolved?.email ?? "").trim().toLowerCase();
        if (!loginEmail) {
          throw new Error("Invalid username/email or password.");
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (signInError) throw signInError;

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

      await supabase.auth.getSession();

      window.location.assign(
        returnTo
          ? `/auth/post-login?returnTo=${encodeURIComponent(returnTo)}`
          : "/auth/post-login"
      );
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="oura-card">
        <CardHeader>
          <div className="text-center text-[13px] font-semibold tracking-[0.32em] uppercase text-white/80">
            Travellers Club
          </div>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>Login with username or email and password</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Username or email</Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="Username or email"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
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

                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 opacity-80 hover:opacity-100"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="text-xs opacity-70">
                  {emailOk && magicHref ? (
                    <Link
                      href={magicHref}
                      onClick={handleMagicLinkClick}
                      className="underline underline-offset-4"
                    >
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
