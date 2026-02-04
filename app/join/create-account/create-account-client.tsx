"use client";

import { useSearchParams } from "next/navigation";
import { createMemberAccount } from "./actions";

export default function CreateAccountClient() {
  const sp = useSearchParams();
  const applicationId = sp.get("applicationId") ?? "";
  const err = sp.get("err") ?? "";

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

      <form action={createMemberAccount} className="space-y-3 rounded border p-4">
        <input type="hidden" name="applicationId" value={applicationId} />

        <div className="space-y-1">
          <label className="text-sm font-medium">Password</label>
          <input
            name="password"
            type="password"
            minLength={8}
            required
            className="w-full rounded border px-3 py-2"
            placeholder="At least 8 characters"
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
