import { createAdminClient } from "@/lib/supabase/admin";
import {
  addDaysYmd,
  isAccessActiveAtJamaicaCutoff,
  jamaicaTodayYmd,
  normalizeToYmd,
} from "@/lib/membership/status";

const THROTTLE_SECONDS = 300;
const LAST_RUN_KEY = "membership_auto_downgrade_last_epoch";

export async function maybeRunAutoDowngradeToFree() {
  const admin = createAdminClient();

  const nowEpoch = Math.floor(Date.now() / 1000);
  const todayYmd = jamaicaTodayYmd();

  // Simple throttle so layouts can call this safely without heavy repeated runs.
  const { data: lastRunRow } = await admin
    .from("app_settings")
    .select("int_value")
    .eq("key", LAST_RUN_KEY)
    .maybeSingle();

  const lastRun = Number(lastRunRow?.int_value ?? 0);
  if (Number.isFinite(lastRun) && nowEpoch - lastRun < THROTTLE_SECONDS) {
    return { ran: false as const, downgraded: 0 };
  }

  await admin.from("app_settings").upsert(
    { key: LAST_RUN_KEY, int_value: nowEpoch },
    { onConflict: "key" },
  );

  const { data: freePlan } = await admin
    .from("membership_plans")
    .select("id, code, name, duration_days")
    .eq("code", "rewards_free")
    .maybeSingle();

  if (!freePlan?.id) return { ran: true as const, downgraded: 0 };

  const freeDuration = Number(freePlan.duration_days ?? 3650);
  const freePaidThrough = addDaysYmd(todayYmd, Math.max(freeDuration, 1));

  const { data: rows } = await admin
    .from("memberships")
    .select(
      "id, member_id, status, start_date, paid_through_date, membership_plans(code, name, duration_days)",
    )
    .limit(1000);

  let downgraded = 0;

  for (const row of rows ?? []) {
    const planRaw: any = (row as any)?.membership_plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    const code = String(plan?.code ?? "").toLowerCase();
    if (!code || code === "rewards_free") continue;

    const activeNow = isAccessActiveAtJamaicaCutoff({
      status: (row as any)?.status ?? null,
      startDate: (row as any)?.start_date ?? null,
      paidThroughDate: (row as any)?.paid_through_date ?? null,
      durationDays: Number(plan?.duration_days ?? 0),
    });

    if (activeNow) continue;

    const expiredOn =
      normalizeToYmd((row as any)?.paid_through_date ?? null) ??
      normalizeToYmd((row as any)?.start_date ?? null) ??
      todayYmd;

    const { error } = await admin
      .from("memberships")
      .update({
        plan_id: freePlan.id,
        status: "active",
        start_date: todayYmd,
        paid_through_date: freePaidThrough,
        needs_contact: false,
        downgraded_from_plan_code: code,
        downgraded_from_plan_name: String(plan?.name ?? "Paid Plan"),
        downgraded_on: expiredOn,
      } as any)
      .eq("id", (row as any).id);

    if (!error) downgraded += 1;
  }

  return { ran: true as const, downgraded };
}
