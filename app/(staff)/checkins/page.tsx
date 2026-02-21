import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OkBanner } from "./OkBanner";
import { AutoClearOk } from "./AutoClearOk";

export const dynamic = "force-dynamic";

function todayJM(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function jamaicaDayRangeUtc() {
  const offsetMs = 5 * 60 * 60 * 1000; // Jamaica UTC-5
  const now = new Date();
  const jmLocal = new Date(now.getTime() - offsetMs);
  jmLocal.setHours(0, 0, 0, 0);
  const startUtc = new Date(jmLocal.getTime() + offsetMs);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string }>;
}) {
  const supabase = await createClient();

  const today = todayJM();
  const { startUtc, endUtc } = jamaicaDayRangeUtc();

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ?? "";

  // Pull only today's check-ins (Jamaica day mapped to UTC range)
  const { data: rows, error } = await supabase
    .from("checkins")
    .select("id, checked_in_at, member_id, members(full_name, phone)")
    .gte("checked_in_at", startUtc.toISOString())
    .lt("checked_in_at", endUtc.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(200);

  const todayRows = rows ?? [];

  // Load membership plan access flags for the members in today's check-ins
  const memberIds = Array.from(new Set((todayRows ?? []).map((r: any) => r.member_id).filter(Boolean)));

  const membershipByMemberId = new Map<
    string,
    {
      status: string | null;
      planName: string | null;
      planCode: string | null;
      planType: string | null;
      grantsAccess: boolean;
      startDate: string | null;
    }
  >();

  if (memberIds.length) {
    const { data: msRows } = await supabase
      .from("memberships")
      .select("member_id, status, start_date, membership_plans(name, code, plan_type, grants_access)")
      .in("member_id", memberIds);

    (msRows ?? []).forEach((row: any) => {
      const key = String(row.member_id);
      const planRaw: any = row?.membership_plans;
      const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
      const next = {
        status: row?.status ?? null,
        planName: plan?.name ?? null,
        planCode: plan?.code ?? null,
        planType: plan?.plan_type ?? null,
        grantsAccess: !!plan?.grants_access,
        startDate: row?.start_date ?? null,
      };

      const prev = membershipByMemberId.get(key);
      if (!prev) {
        membershipByMemberId.set(key, next);
        return;
      }

      const prevActive = prev.status === "active";
      const nextActive = next.status === "active";
      if (!prevActive && nextActive) {
        membershipByMemberId.set(key, next);
        return;
      }
      if (prevActive === nextActive) {
        const prevStart = String(prev.startDate ?? "");
        const nextStart = String(next.startDate ?? "");
        if (nextStart > prevStart) {
          membershipByMemberId.set(key, next);
        }
      }
    });
  }

  function accessLabelFor(memberId: string) {
    const ms = membershipByMemberId.get(String(memberId));
    if (!ms) return { label: "—", kind: "unknown" as const };

    const active = ms.status === "active";
    const isDayPass =
      String(ms.planType ?? "").toLowerCase() === "pass" ||
      String(ms.planCode ?? "").toLowerCase() === "club_day" ||
      String(ms.planName ?? "").toLowerCase().includes("day pass");

    if (active && isDayPass) return { label: "Day Pass", kind: "ok" as const };
    if (active && ms.grantsAccess) return { label: "Gym Access", kind: "ok" as const };
    if (active && !ms.grantsAccess) return { label: "Dining Only", kind: "warn" as const };
    return { label: "Not Active", kind: "bad" as const };
  }


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
          <Link
            key={r.id}
            href={`/members/${r.member_id}`}
            className="block oura-card p-3 hover:bg-white/5"
          >
            <div className="font-medium">{r.members?.full_name ?? "Member"}</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-sm opacity-70">{r.members?.phone ?? r.member_id}</span>
              {(() => {
                const a = accessLabelFor(String(r.member_id));
                const cls =
                  a.kind === "ok"
                    ? "bg-emerald-400/15 text-emerald-50 border-emerald-300/40 ring-emerald-200/20 shadow-emerald-500/10"
                    : a.kind === "warn" ? "bg-[#C8A24A]/28 text-[#FFF3CC] border-[#C8A24A]/75 ring-[#C8A24A]/35 shadow-[#C8A24A]/25"
                    : a.kind === "bad"
                    ? "bg-red-400/15 text-red-50 border-red-300/40 ring-red-200/20 shadow-red-500/10"
                    : "bg-white/6 text-white/80 border-white/15 ring-white/10";

                return (
                  <span
                    className={[
                      "inline-flex items-center rounded-full border px-3.5 py-1 text-[11px] font-semibold leading-none uppercase tracking-wide shadow-sm backdrop-blur ring-1 ring-inset",
                      cls,
                    ].join(" ")}
                  >
                    {a.label}
                  </span>
                );
              })()}
            </div>
            <div className="mt-1 text-xs opacity-60">
              {new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Jamaica",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              }).format(new Date(r.checked_in_at))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
