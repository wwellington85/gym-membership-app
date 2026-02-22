"use client";

import { useFormStatus } from "react-dom";

export function PaymentSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="w-full rounded border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? "Saving payment..." : "Save Payment"}
    </button>
  );
}
