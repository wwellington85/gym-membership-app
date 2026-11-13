"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeReturnTo } from "@/lib/auth/return-to";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MagicLinkPage() {
  const [email, setEmail] = useState("");
  const [returnTo, setReturnTo] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") || "");
    setReturnTo(safeReturnTo(params.get("returnTo")));
  }, []);

  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const loginHref = returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : "/auth/login";
  const retryIn = Math.max(0, Math.ceil((retryAt - now) / 1000));

  const send = async () => {
    const cleanEmail = (sentEmail || email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return;
    setError(null);
    setIsLoading(true);
    try {
      const confirmUrl = `${window.location.origin}/auth/confirm${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
      const { error } = await createClient().auth.signInWithOtp({
        email: cleanEmail,
        options: { emailRedirectTo: confirmUrl, shouldCreateUser: false },
      });
      if (error) throw error;
      setSentEmail(cleanEmail);
      setCode("");
      setNow(Date.now());
      setRetryAt(Date.now() + 60_000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send your sign-in email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { error } = await createClient().auth.verifyOtp({ email: sentEmail, token: code.trim(), type: "email" });
      if (error) throw error;
      window.location.assign(`/auth/post-login${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
    } catch {
      setError("That code could not be verified. Use the code from your latest email. If you already opened its link or the code expired, request a new email.");
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full items-center py-2">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">{sentEmail ? "Check your email" : "Sign in by email"}</CardTitle>
          <CardDescription>
            {sentEmail ? `If an account exists for ${sentEmail}, you’ll receive a sign-in email.` : "We’ll email you a sign-in code and a secure link. Use either to sign in."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sentEmail ? (
            <>
              <p className="text-sm text-muted-foreground">Check your inbox and junk folder for Travellers Beach Resort. To sign in here, return to this screen and enter the code. Opening the email link signs you in in the browser that opens it.</p>
              <form onSubmit={verify} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Email sign-in code</Label>
                  <Input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" maxLength={8} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || !/^\d{6,8}$/.test(code)}>{isLoading ? "Please wait…" : "Verify code and sign in"}</Button>
              </form>
              <div className="flex flex-wrap gap-4 text-sm">
                <button type="button" className="underline disabled:opacity-50" disabled={isLoading || retryIn > 0} onClick={send}>{retryIn > 0 ? `Send again in ${retryIn}s` : "Send a new email"}</button>
                <button type="button" className="underline" disabled={isLoading} onClick={() => { setSentEmail(""); setCode(""); setError(null); }}>Use another email</button>
              </div>
            </>
          ) : (
            <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading || !emailOk}>{isLoading ? "Sending…" : "Email me a code and link"}</Button>
              <button type="button" className="text-sm underline disabled:opacity-50" disabled={isLoading || !emailOk} onClick={() => { setSentEmail(email.trim().toLowerCase()); setError(null); }}>I already have a code</button>
            </form>
          )}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="text-center text-sm"><Link className="underline underline-offset-4" href={loginHref}>Sign in with a password</Link></div>
        </CardContent>
      </Card>
    </div>
  );
}
