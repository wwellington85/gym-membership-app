import Link from "next/link";

export default function MorePage() {
  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="text-2xl font-semibold">More</h1>
      <p className="mt-1 text-sm opacity-70">Quick links for admin tools.</p>

      <div className="mt-4 space-y-2">
        <Link className="block rounded border p-3" href="/applications">
          Applications
        </Link>
        <Link className="block rounded border p-3" href="/settings">
          Settings
        </Link>
      </div>
    </div>
  );
}
