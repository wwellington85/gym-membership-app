export default function JoinSuccessPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      <h1 className="text-xl font-semibold">Request received</h1>
      <p className="text-sm opacity-70">
        Thanks! Your gym membership request was submitted. Please visit the front desk to complete payment and activate your membership.
      </p>

      <div className="rounded border p-3 text-sm">
        <div className="font-medium">Next step</div>
        <div className="mt-1 opacity-70">
          Front Desk will confirm your plan, start date, and collect payment.
        </div>
      </div>

      <a className="inline-block rounded border px-3 py-2 text-sm hover:bg-gray-50" href="/join">
        Submit another request
      </a>
    </div>
  );
}
