import Link from "next/link";

export default function MorePage() {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold">More</h1>
      <p className="mt-1 text-sm opacity-70">Quick links for admin tools.</p>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Link className="block rounded border p-3" href="/more/rewards">
          Rewards Manager
        </Link>
        <Link className="block rounded border p-3" href="/settings">
          Settings
        </Link>
        <Link className="block rounded border p-3" href="/settings/staff">
          Staff Management
        </Link>
        <Link className="block rounded border p-3" href="/settings/logs">
          Activity Logs
        </Link>
      </div>
    </div>
  );
}
