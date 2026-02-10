import Link from "next/link";

export default function PaymentReturnPage({
  searchParams,
}: {
  searchParams: { reference?: string; customReference?: string };
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Payment received</h1>
      <p className="text-sm opacity-70">
        Thanks — we’re confirming your payment now. This usually updates within a few seconds.
      </p>

      <div className="rounded border p-3 text-sm">
        <div><span className="opacity-70">Fygaro reference:</span> {searchParams.reference ?? "—"}</div>
        <div><span className="opacity-70">Your reference:</span> {searchParams.customReference ?? "—"}</div>
      </div>

      <div className="flex gap-2">
        <Link className="rounded border px-3 py-2 text-sm hover:bg-gray-50" href="/member">
          Go to dashboard
        </Link>
        <Link className="rounded border px-3 py-2 text-sm hover:bg-gray-50" href="/member/card">
          View membership card
        </Link>
      </div>
    </div>
  );
}
