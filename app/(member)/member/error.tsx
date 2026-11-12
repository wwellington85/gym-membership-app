"use client";
import Link from "next/link";
export default function MemberError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        We could not load this information
      </h1>
      <p>
        Please try again. If you need to use a benefit or pass now, ask the
        front desk to verify your membership.
      </p>
      <button onClick={reset} className="rounded border p-3">
        Try again
      </button>
      <Link href="/member/help" className="block py-3 underline">
        Membership help
      </Link>
    </div>
  );
}
