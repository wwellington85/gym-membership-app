import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OkBanner } from "./OkBanner";
import { AutoClearOk } from "./AutoClearOk";

export const dynamic = "force-dynamic";

function todayJM(): string {
  // returns YYYY-MM-DD in Jamaica time
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string }>;
}) {
  const supabase = await createClient();

  const today = todayJM();

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ?? "";

  // Pull today's check-ins (by checked_in_at date in Jamaica time)
  const { data: rows, error } = await supabase
    .from("checkins")
    .select("id, checked_in_at, member_id, members(full_name, phone)")
    .order("checked_in_at", { ascending: false })
    .limit(200);

  const todayRows =
    (rows ?? []).filter((r: any) => {
      const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica" }).format(
        new Date(r.checked_in_at)
      );
      return d === today;
    }) ?? [];

  return (
    <div className="space-y-4">
      <OkBanner ok={ok} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Check-ins</h1>
          <p className="text-sm opacity-70">Today ({today})</p>
        </div>
<div className="flex gap-2">
          <Link href="/checkins/scan" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Scan
          </Link>
          <Link href="/members" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Members
          </Link>
        </div>
</div>

      <AutoClearOk enabled={!!ok} href="/checkins" />

      {error ? (
        <div className="rounded border p-3 text-sm">
          Could not load check-ins.
          <div className="mt-1 text-xs opacity-70">{error.message}</div>
        </div>
      ) : null}

      {!error && todayRows.length === 0 ? (
        <div className="rounded border p-3 text-sm opacity-70">No check-ins recorded today.</div>
      ) : null}

      <div className="space-y-2">
        {todayRows.map((r: any) => (
          <div key={r.id} className="oura-card p-3">
            <div className="font-medium">{r.members?.full_name ?? "Member"}</div>
            <div className="text-sm opacity-70">{r.members?.phone ?? r.member_id}</div>
            <div className="mt-1 text-xs opacity-60">
              {new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Jamaica",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(r.checked_in_at))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
