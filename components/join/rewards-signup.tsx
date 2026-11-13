"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function RewardsSignup() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function join(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const { data: result, error } = await createClient().auth.signUp({
        email: String(data.get("email") || "").trim(),
        password: String(data.get("password") || ""),
        options: {
          data: {
            full_name: String(data.get("full_name") || "").trim(),
            is_member: true,
          },
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      if (result.session)
        window.location.assign("/auth/post-login?returnTo=/member");
      else setSent(true);
    } catch {
      setError(
        "We could not complete signup. Try again, or sign in if you already have an account.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (sent)
    return (
      <div role="status" className="space-y-3 rounded border p-4">
        <h2 className="font-semibold">Check your email</h2>
        <p className="text-sm">
          Follow the confirmation link to finish joining. If you already have an
          account, sign in to use your existing membership.
        </p>
        <Link
          href="/auth/login"
          className="inline-block rounded border px-4 py-3"
        >
          Sign in
        </Link>
      </div>
    );
  return (
    <form onSubmit={join} className="space-y-4">
      <div>
        <label htmlFor="join-name" className="block text-sm">
          Full name
        </label>
        <input
          id="join-name"
          name="full_name"
          required
          maxLength={120}
          autoComplete="name"
          className="oura-input mt-2 w-full p-3"
        />
      </div>
      <div>
        <label htmlFor="join-email" className="block text-sm">
          Email
        </label>
        <input
          id="join-email"
          name="email"
          required
          type="email"
          autoComplete="email"
          className="oura-input mt-2 w-full p-3"
        />
      </div>
      <div>
        <label htmlFor="join-password" className="block text-sm">
          Create a password
        </label>
        <input
          id="join-password"
          name="password"
          required
          type="password"
          minLength={8}
          autoComplete="new-password"
          aria-describedby="join-password-hint"
          className="oura-input mt-2 w-full p-3"
        />
        <p id="join-password-hint" className="mt-2 text-sm text-muted-foreground">
          At least 8 characters.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Rewards is free. Gym and resort access are optional purchases, with
        their own dates and facility waiver.
      </p>
      {error && (
        <p role="alert" className="oura-alert-danger">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded border bg-primary text-primary-foreground px-4 py-3 font-medium disabled:opacity-50"
      >
        {busy ? "Creating account…" : "Join Rewards free"}
      </button>
      <p className="text-sm">
        Already a member?{" "}
        <Link className="underline" href="/auth/login">
          Sign in or recover your account
        </Link>
      </p>
    </form>
  );
}
