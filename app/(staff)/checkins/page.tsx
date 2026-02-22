import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAccessActiveAtJamaicaCutoff } from "@/lib/membership/status";
import { OkBanner } from "./OkBanner";
import { AutoClearOk } from "./AutoClearOk";

export const dynamic = "force-dynamic";

type RangeKey = "today" | "yesterday" | "7" | "30" | "60" | "90";

function todayJM(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function jamaicaDayStartUtc() {
  const offsetMs = 5 * 60 * 60 * 1000; // Jamaica UTC-5
  const now = new Date();
  const jmLocal = new Date(now.getTime() - offsetMs);
  jmLocal.setHours(0, 0, 0, 0);
  return new Date(jmLocal.getTime() + offsetMs);
}

function rangeBoundsUtc(range: RangeKey) {
  const startTodayUtc = jamaicaDayStartUtc();
  const dayMs = 24 * 60 * 60 * 1000;

  if (range === "today") {
    return {
      startUtc: startTodayUtc,
      endUtc: new Date(startTodayUtc.getTime() + dayMs),
      label: `Today (${todayJM()})`,
    };
  }
  if (range === "yesterday") {
    return {
      startUtc: new Date(startTodayUtc.getTime() - dayMs),
      endUtc: startTodayUtc,
      label: "Yesterday",
    };
  }

  const days = Number.parseInt(range, 10);
  const safeDays = Number.isFinite(days) ? Math.max(1, days) : 7;
  return {
    startUtc: new Date(startTodayUtc.getTime() - (safeDays - 1) * dayMs),
    endUtc: new Date(startTodayUtc.getTime() + dayMs),
    label: `Last ${safeDays} days`,
  };
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; range?: string }>;
}) {
  const supabase = await createClient();

  const sp = (await searchParams) ?? {};
  const ok = sp.ok ?? "";
  const range = (["today", "yesterday", "7", "30", "60", "90"] as RangeKey[]).includes(
    String(sp.range ?? "") as RangeKey,
  )
    ? (String(sp.range) as RangeKey)
    : "today";
  const { startUtc, endUtc, label } = rangeBoundsUtc(range);

  // Pull check-ins for selected Jamaica date window
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
      durationDays: number | null;
      grantsAccess: boolean;
      startDate: string | null;
      paidThroughDate: string | null;
    }
  >();

  if (memberIds.length) {
    const { data: msRows } = await supabase
      .from("memberships")
      .select(
        "member_id, status, start_date, paid_through_date, membership_plans(name, code, plan_type, duration_days, grants_access)",
      )
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
        durationDays:
          typeof plan?.duration_days === "number" ? plan.duration_days : null,
        grantsAccess: !!plan?.grants_access,
        startDate: row?.start_date ?? null,
        paidThroughDate: row?.paid_through_date ?? null,
      };

      const prev = membershipByMemberId.get(key);
      if (!prev) {
        membershipByMemberId.set(key, next);
        return;
      }

      const prevActive = isAccessActiveAtJamaicaCutoff({
        status: prev.status,
        startDate: prev.startDate,
        paidThroughDate: prev.paidThroughDate,
        durationDays: prev.durationDays,
      });
      const nextActive = isAccessActiveAtJamaicaCutoff({
        status: next.status,
        startDate: next.startDate,
        paidThroughDate: next.paidThroughDate,
        durationDays: next.durationDays,
      });
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

    const activeNow = isAccessActiveAtJamaicaCutoff({
      status: ms.status,
      startDate: ms.startDate,
      paidThroughDate: ms.paidThroughDate,
      durationDays: ms.durationDays,
    });
    const planType = String(ms.planType ?? "").toLowerCase();
    const planCode = String(ms.planCode ?? "").toLowerCase();
    const planName = String(ms.planName ?? "").toLowerCase();
    const isDayPass =
      planType === "pass" ||
      planCode === "club_day" ||
      planCode.includes("day") ||
      planCode.includes("daily") ||
      planName.includes("day pass") ||
      planName.includes("day") ||
      ms.durationDays === 1;

    if (isDayPass && activeNow) {
      return { label: "Day Pass", kind: "ok" as const };
    }
    if (isDayPass && !activeNow) {
      return { label: "Expired", kind: "bad" as const };
    }
    if (activeNow && ms.grantsAccess) return { label: "Gym Access", kind: "ok" as const };
    if (activeNow && !ms.grantsAccess) return { label: "Dining Only", kind: "warn" as const };
    return { label: "Not Active", kind: "bad" as const };
  }


  return (
    <div className="space-y-4">
      <OkBanner ok={ok} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Check-ins</h1>
          <p className="text-sm opacity-70">{label}</p>
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

      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { key: "today", label: "Today" },
          { key: "yesterday", label: "Yesterday" },
          { key: "7", label: "Last 7 days" },
          { key: "30", label: "Last 30" },
          { key: "60", label: "Last 60" },
          { key: "90", label: "Last 90" },
        ].map((r) => {
          const active = range === r.key;
          return (
            <Link
              key={r.key}
              href={`/checkins?range=${r.key}`}
              className={["rounded border px-2.5 py-1", active ? "font-semibold" : "opacity-80"].join(" ")}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      <AutoClearOk enabled={!!ok} href="/checkins" />

      {error ? (
        <div className="rounded border p-3 text-sm">
          Could not load check-ins.
          <div className="mt-1 text-xs opacity-70">{error.message}</div>
        </div>
      ) : null}

      {!error && todayRows.length === 0 ? (
        <div className="rounded border p-3 text-sm opacity-70">No check-ins found for this period.</div>
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
