import Link from "next/link";

export const dynamic = "force-dynamic";

export default function JoinSuccessPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-3 px-4 py-10">
      <meta httpEquiv="refresh" content="3;url=/join?success=1" />
      <h1 className="text-xl font-semibold">Thanks! We received your request.</h1>
      <p className="text-sm opacity-70">Returning to the Join page…</p>
      <p className="text-sm">
        <Link className="underline" href="/join?success=1">
          Continue now
        </Link>
      </p>
    </div>
  );
}
