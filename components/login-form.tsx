"use client";

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
import { useCallback, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { GoogleSignIn } from "@/components/google-sign-in";

function isValidEmail(v: string) {
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function LoginForm({
  className,
  googleEnabled = false,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { googleEnabled?: boolean }) {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";
  const staffLogin = searchParams.get("staff") === "1";
  const [identifier, setIdentifier] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sentType = searchParams.get("sent") || "";
  const showSent = sentType !== "";
  const returnToRaw = searchParams.get("returnTo") || "";

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
    [identifier],
  );

  const errMsg = searchParams.get("err") || "";

  const sentMsg = useMemo(() => {
    if (!sentType) return "";
    if (sentType === "1")
      return "Password reset email sent. Please check your inbox.";
    if (sentType === "magic")
      return "Login link sent. Please check your email (and spam/junk).";
    return "";
  }, [sentType]);

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
        })
          .then((r) => r.json())
          .catch(() => ({ email: null }));

        loginEmail = String(resolved?.email ?? "")
          .trim()
          .toLowerCase();
        if (!loginEmail) {
          throw new Error("Invalid username/email or password.");
        }
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (signInError) throw signInError;

      const { data: sessionRes, error: sessionErr } =
        await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;

      const sess = sessionRes?.session;
      if (!sess?.access_token || !sess?.refresh_token) {
        throw new Error(
          "Login succeeded but session was missing. Please try again.",
        );
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
          : "/auth/post-login",
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
          <CardTitle className="text-2xl">
            {staffLogin ? "Employee sign in" : "Welcome back."}
          </CardTitle>
          <CardDescription>
            {staffLogin
              ? "Employee sign in with username or email"
              : "Your card, benefits, and visits in one place."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {googleEnabled && !staffLogin && <GoogleSignIn returnTo={returnTo} />}
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">
                  {staffLogin ? "Username or email" : "Email"}
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder={
                    staffLogin ? "Username or email" : "you@example.com"
                  }
                  autoComplete="username"
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
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-muted-foreground"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="text-xs text-muted-foreground">
                  {emailOk && magicHref ? (
                    <Link
                      href={magicHref}
                      onClick={handleMagicLinkClick}
                      className="underline underline-offset-4"
                    >
                      Sign in with an email code or link
                    </Link>
                  ) : (
                    <span className="cursor-not-allowed opacity-50">
                      Sign in with an email code or link
                    </span>
                  )}
                  {!emailOk ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      Enter your email first
                    </span>
                  ) : null}
                </div>
              </div>

              {showSent && sentMsg && (
                <p className="text-sm text-emerald-800">{sentMsg}</p>
              )}
              {errMsg && <p className="text-sm text-destructive">{errMsg}</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Signing in…" : "Sign in"}
              </Button>
            </div>

            <div className="mt-4 text-center text-sm">
              New to Travellers?{" "}
              <Link href="/join" className="underline underline-offset-4">
                Join Travellers Club
              </Link>
            </div>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="underline">
              Privacy notice
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
