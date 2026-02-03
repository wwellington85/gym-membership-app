"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get("returnTo") || "/dashboard";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const [sessionMissing, setSessionMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;

      if (error) {
        setSessionMissing(true);
        setError(error.message);
        return;
      }

      if (!data.session) {
        setSessionMissing(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const validate = () => {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      // Common case if invite/reset link already used/expired
      if (error.message.toLowerCase().includes("auth session missing")) {
        setSessionMissing(true);
        setError("Your link is no longer valid. It may have expired or already been used.");
        return;
      }
      setError(error.message);
      return;
    }

    router.replace(returnTo);
  };

  if (sessionMissing) {
    return (
      <div className="rounded-lg border p-4">
        <h2 className="text-base font-semibold">Link expired or already used</h2>
        <p className="mt-2 text-sm opacity-80">
          For security, password links can only be used once and may expire. Please request a new invite or use
          “Forgot password” if your account already exists.
        </p>
        {error ? (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <Link className="rounded border px-3 py-2 text-sm" href="/auth/login">
            Go to login
          </Link>
          <Link className="rounded border px-3 py-2 text-sm" href="/auth/forgot-password">
            Forgot password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border p-4">
      <h2 className="text-base font-semibold">Set your password</h2>
      <p className="mt-1 text-sm opacity-70">Choose a new password to finish setting up your account.</p>

      <label className="mt-4 block text-sm">
        New password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          autoComplete="new-password"
          required
        />
      </label>

      <label className="mt-3 block text-sm">
        Confirm password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          autoComplete="new-password"
          required
        />
      </label>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
