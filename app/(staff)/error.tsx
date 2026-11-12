"use client";
import Link from "next/link";
export default function StaffError({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        Service information is unavailable
      </h1>
      <p>
        Try again before recording a payment or allowing access. Do not infer
        eligibility from a previous screen.
      </p>
      <button onClick={reset} className="rounded border p-3">
        Try again
      </button>
      <Link href="/members" className="block py-3 underline">
        Member lookup
      </Link>
    </div>
  );
}
