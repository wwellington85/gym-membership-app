"use client";

import { useFormStatus } from "react-dom";
import { setStaffPassword } from "@/app/(staff)/settings/staff/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
    >
      {pending ? "Updating password…" : "Update password"}
    </button>
  );
}

export function SetStaffPasswordForm({ userId, returnTo, username }: {
  userId: string;
  returnTo: string;
  username: string;
}) {
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer text-sm font-medium">Set password</summary>
      <p className="mt-2 text-xs text-muted-foreground">
        Set a new password for {username} and share it with them directly. They can sign in immediately using their username. No email is sent.
      </p>
      <form action={setStaffPassword} className="mt-3 space-y-2">
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="user_id" value={userId} />
        <label className="block text-sm">
          New password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Confirm new password
          <input
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
        <SubmitButton />
      </form>
    </details>
  );
}
