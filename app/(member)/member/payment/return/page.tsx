import Link from "next/link";

export default function PaymentReturnPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Thanks — processing your payment</h1>
        <p className="text-sm opacity-70">
          Your membership will update as soon as we receive confirmation from the payment processor.
          This usually takes a few seconds.
        </p>
      </div>

      <div className="rounded border p-4 text-sm space-y-2">
        <div>Tip: If your status hasn’t updated yet, refresh in a moment.</div>
        <div>
          <Link className="underline underline-offset-4" href="/member">
            Return to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
