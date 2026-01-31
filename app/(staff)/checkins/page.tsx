export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function jamaicaDayRangeUtc() {
  const offsetMs = 5 * 60 * 60 * 1000; // Jamaica UTC-5
  const now = new Date();
  const jmLocal = new Date(now.getTime() - offsetMs);
  jmLocal.setHours(0, 0, 0, 0);
  const startUtc = new Date(jmLocal.getTime() + offsetMs);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc, endUtc };
}

function fmtJamaica(ts: string) {
  return new Date(ts).toLocaleString("en-US", { timeZone: "America/Jamaica" });
}

export default async function CheckinsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; done?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const q = (sp.q ?? "").trim();
  const done = sp.done ?? ""; // "1" or "already"

  const { startUtc, endUtc } = jamaicaDayRangeUtc();

  async function checkIn(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const member_id = String(formData.get("member_id") || "");
    const q = String(formData.get("q") || "").trim();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    // Read setting (default 1)
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("int_value")
      .eq("key", "points_per_checkin")
      .maybeSingle();

    const pointsEarned = settingRow?.int_value ?? 1;

    const { error } = await supabase.from("checkins").insert({
      member_id,
      staff_user_id: user.id,
      points_earned: pointsEarned,
    });

    const qs = new URLSearchParams();
    if (q) qs.set("q", q);

    if (error) {
      if ((error as any).code === "23505") {
        qs.set("done", "already");
        redirect(`/checkins?${qs.toString()}`);
      }
      throw new Error(`Check-in failed: ${error.message}`);
    }

    qs.set("done", "1");
    redirect(`/checkins?${qs.toString()}`);
  }

  const { data: todaysCheckins, error: todaysErr } = await supabase
    .from("checkins")
    .select("id, checked_in_at, points_earned, member:members(id, full_name, phone)")
    .gte("checked_in_at", startUtc.toISOString())
    .lt("checked_in_at", endUtc.toISOString())
    .order("checked_in_at", { ascending: false })
    .limit(200);

  let matchingMembers: any[] = [];
  if (q) {
    const { data: members } = await supabase
      .from("members")
      .select("id, full_name, phone")
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    matchingMembers = members ?? [];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Check-ins</h1>
        <p className="text-sm opacity-70">Track gym visits and daily usage</p>
      </div>

      {done === "1" ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-medium">Checked in</div>
          <div className="mt-1 opacity-80">Member visit recorded successfully.</div>
        </div>
      ) : null}

      {done === "already" ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="font-medium">Already checked in</div>
          <div className="mt-1 opacity-80">This member already checked in today.</div>
        </div>
      ) : null}

      <form className="rounded border p-3 space-y-2" action="/checkins" method="get">
        <div className="text-sm font-medium">Find member</div>
        <input
          name="q"
          defaultValue={q}
          className="w-full rounded border px-3 py-2"
          placeholder="Search name or phone…"
        />
        <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Search
        </button>
      </form>

      {q ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">Search results</div>
          {matchingMembers.length === 0 ? (
            <div className="rounded border p-3 text-sm opacity-70">No members found.</div>
          ) : (
            <div className="space-y-2">
              {matchingMembers.map((m) => (
                <div key={m.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-sm opacity-70">{m.phone}</div>
                      <Link
                        href={`/members/${m.id}`}
                        className="text-xs underline underline-offset-2 opacity-80"
                      >
                        View profile
                      </Link>
                    </div>

                    <form action={checkIn}>
                      <input type="hidden" name="member_id" value={m.id} />
                      <input type="hidden" name="q" value={q} />
                      <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
                        Check in
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Today’s check-ins</h2>
          <span className="text-xs opacity-70">{todaysCheckins?.length ?? 0}</span>
        </div>

        {todaysErr ? (
          <div className="rounded border p-3 text-sm">
            Could not load today’s check-ins.
            <div className="mt-1 text-xs opacity-70">{todaysErr.message}</div>
          </div>
        ) : null}

        {!todaysErr && (!todaysCheckins || todaysCheckins.length === 0) ? (
          <div className="rounded border p-3 text-sm opacity-70">
            No check-ins recorded today.
          </div>
        ) : null}

        <div className="space-y-2">
          {(todaysCheckins ?? []).map((c: any) => (
            <div key={c.id} className="rounded border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{c.member?.full_name ?? "Member"}</div>
                  <div className="text-sm opacity-70">{c.member?.phone ?? ""}</div>
                  {c.member?.id ? (
                    <Link
                      href={`/members/${c.member.id}`}
                      className="text-xs underline underline-offset-2 opacity-80"
                    >
                      View profile
                    </Link>
                  ) : null}
                  <div className="mt-1 text-xs opacity-70">
                    Points earned: {c.points_earned ?? 1}
                  </div>
                </div>
                <div className="text-xs opacity-70">{fmtJamaica(c.checked_in_at)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
