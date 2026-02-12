"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { createMemberAccount } from "./actions";

export default function CreateAccountClient() {
  const sp = useSearchParams();
  const applicationId = sp.get("applicationId") ?? "";
  const err = sp.get("err") ?? "";

  const [clientErr, setClientErr] = useState<string>("");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="text-sm opacity-70">
          Set a password to access your Travellers Club profile and membership card.
        </p>
      </div>

      {err ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
          Error: {err}
        </div>
      ) : null}

      {clientErr ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          {clientErr}
        </div>
      ) : null}

      <form
        action={createMemberAccount}
        className="space-y-3 rounded border p-4"
        onSubmit={(e) => {
          setClientErr("");
          const form = e.currentTarget as HTMLFormElement;
          const pw = (form.elements.namedItem("password") as HTMLInputElement)?.value ?? "";
          const pw2 = (form.elements.namedItem("password_confirm") as HTMLInputElement)?.value ?? "";
          if (pw.length < 8) {
            e.preventDefault();
            setClientErr("Password must be at least 8 characters.");
            return;
          }
          if (pw !== pw2) {
            e.preventDefault();
            setClientErr("Passwords do not match.");
            return;
          }
        }}
      >
        <input type="hidden" name="applicationId" value={applicationId} />

        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            name="password"
            type="password"
            minLength={8}
            required
            className="w-full oura-input px-3 py-2"
            placeholder="At least 8 characters"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Confirm password</label>
          <input
            name="password_confirm"
            type="password"
            minLength={8}
            required
            className="w-full oura-input px-3 py-2"
            placeholder="Re-enter password"
          />
        </div>

        <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Create account
        </button>
      </form>

      <div className="text-xs opacity-60">
        You’ll be signed in automatically after creating your password.
      </div>
    </div>
  );
}
