import Link from "next/link";

export default function MorePage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">More</h1>
      <p className="mt-1 text-sm opacity-70">
        Programme administration and staff tools.
      </p>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Link className="block rounded border p-3" href="/more/rewards">
          Programme & Benefits
        </Link>
        <Link className="block rounded border p-3" href="/settings">
          Settings
        </Link>
        <Link className="block rounded border p-3" href="/settings/staff">
          Staff Management
        </Link>
        <Link
          className="block rounded border p-3"
          href="/settings/programme-log"
        >
          Programme audit
        </Link>
      </div>
    </div>
  );
}
