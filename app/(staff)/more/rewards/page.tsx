export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PlanRow = {
  id: string;
  code: string;
  name: string;
  price: number | null;
  duration_days: number | null;
  is_active: boolean | null;
  grants_access: boolean | null;
  discount_food: number | null;
  discount_spa: number | null;
  discount_giftshop: number | null;
  discount_watersports: number | null;
  visible_on_join: boolean | null;
};

type BenefitRow = {
  id: string;
  plan_id: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
};

type ScheduledUpdateRow = {
  id: string;
  plan_id: string;
  effective_on: string;
  discount_food: number | null;
  discount_spa: number | null;
  discount_giftshop: number | null;
  discount_watersports: number | null;
  grants_access: boolean | null;
  visible_on_join: boolean | null;
  note: string | null;
  applied_at: string | null;
};

async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?returnTo=/more/rewards");

  const { data: me } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!me || me.role !== "admin") {
    redirect("/dashboard?err=Not%20authorized");
  }
}

function pctToDb(input: FormDataEntryValue | null) {
  const n = Number(String(input ?? "0"));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n / 100));
}

function pctFromDb(input: number | null | undefined) {
  return Math.round(Number(input ?? 0) * 100);
}

function isMissingBenefitsTable(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "PGRST205" || /membership_plan_benefits/i.test(message);
}

function isMissingScheduledUpdatesTable(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "");
  return code === "PGRST205" || /membership_plan_scheduled_updates/i.test(message);
}

function maybePctToDb(input: FormDataEntryValue | null) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  return pctToDb(raw);
}

function boolModeToValue(input: FormDataEntryValue | null): boolean | null {
  const v = String(input ?? "keep").trim();
  if (v === "yes") return true;
  if (v === "no") return false;
  return null;
}

function todayJM() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function RewardsManagerPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; err?: string; benefit_view?: "active" | "inactive" | "all" }>;
}) {
  const sp = (await searchParams) ?? {};
  const benefitView = sp.benefit_view === "inactive" || sp.benefit_view === "all" ? sp.benefit_view : "active";

  await requireAdminUser();

  const admin = createAdminClient();

  let joinVisibilityFieldAvailable = true;
  let plansRows: any[] | null = null;
  let plansErr: any = null;

  {
    const withJoinVisibility = await admin
      .from("membership_plans")
      .select(
        "id, code, name, price, duration_days, is_active, grants_access, discount_food, discount_spa, discount_giftshop, discount_watersports, visible_on_join"
      )
      .order("price", { ascending: true });

    if (withJoinVisibility.error && /visible_on_join/i.test(String(withJoinVisibility.error.message || ""))) {
      joinVisibilityFieldAvailable = false;
      const fallback = await admin
        .from("membership_plans")
        .select(
          "id, code, name, price, duration_days, is_active, grants_access, discount_food, discount_spa, discount_giftshop, discount_watersports"
        )
        .order("price", { ascending: true });
      plansRows = (fallback.data ?? []).map((p: any) => ({ ...p, visible_on_join: true }));
      plansErr = fallback.error;
    } else {
      plansRows = withJoinVisibility.data;
      plansErr = withJoinVisibility.error;
    }
  }

  if (plansErr) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
        Could not load plans: {plansErr.message}
      </div>
    );
  }

  const plans = (plansRows ?? []) as PlanRow[];
  const planIds = plans.map((p) => p.id);
  let benefitsFeatureUnavailable = false;

  const { data: benefitRows, error: benefitErr } = planIds.length
    ? await admin
        .from("membership_plan_benefits")
        .select("id, plan_id, label, value, sort_order, is_active")
        .in("plan_id", planIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [] as BenefitRow[], error: null as any };

  if (benefitErr && !isMissingBenefitsTable(benefitErr)) {
    return (
      <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
        Could not load plan benefits: {benefitErr.message}
      </div>
    );
  }
  if (benefitErr && isMissingBenefitsTable(benefitErr)) {
    benefitsFeatureUnavailable = true;
  }

  const benefitsByPlan = new Map<string, BenefitRow[]>();
  (benefitRows ?? []).forEach((b: any) => {
    const key = String(b.plan_id);
    const arr = benefitsByPlan.get(key) ?? [];
    arr.push(b as BenefitRow);
    benefitsByPlan.set(key, arr);
  });

  let scheduledUpdatesFeatureUnavailable = false;

  // Auto-apply due scheduled updates.
  {
    const dueRes = await admin
      .from("membership_plan_scheduled_updates")
      .select(
        "id, plan_id, effective_on, discount_food, discount_spa, discount_giftshop, discount_watersports, grants_access, visible_on_join"
      )
      .is("applied_at", null)
      .lte("effective_on", todayJM())
      .order("effective_on", { ascending: true });

    if (dueRes.error && isMissingScheduledUpdatesTable(dueRes.error)) {
      scheduledUpdatesFeatureUnavailable = true;
    } else if (dueRes.error) {
      console.error("Could not load due scheduled updates:", dueRes.error);
    } else {
      for (const u of dueRes.data ?? []) {
        const payload: any = {};
        if (u.discount_food !== null) payload.discount_food = u.discount_food;
        if (u.discount_spa !== null) payload.discount_spa = u.discount_spa;
        if (u.discount_giftshop !== null) payload.discount_giftshop = u.discount_giftshop;
        if (u.discount_watersports !== null) payload.discount_watersports = u.discount_watersports;
        if (u.grants_access !== null) payload.grants_access = u.grants_access;
        if (u.visible_on_join !== null) payload.visible_on_join = u.visible_on_join;

        if (Object.keys(payload).length > 0) {
          let updateErr: any = null;
          const updated = await admin.from("membership_plans").update(payload).eq("id", u.plan_id);
          updateErr = updated.error;

          if (updateErr && /visible_on_join/i.test(String(updateErr.message || ""))) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.visible_on_join;
            updateErr = Object.keys(fallbackPayload).length
              ? (await admin.from("membership_plans").update(fallbackPayload).eq("id", u.plan_id)).error
              : null;
          }

          if (updateErr) {
            console.error("Could not apply scheduled update:", updateErr);
            continue;
          }
        }

        await admin
          .from("membership_plan_scheduled_updates")
          .update({ applied_at: new Date().toISOString() })
          .eq("id", u.id);
      }
    }
  }

  const scheduledRes = await admin
    .from("membership_plan_scheduled_updates")
    .select(
      "id, plan_id, effective_on, discount_food, discount_spa, discount_giftshop, discount_watersports, grants_access, visible_on_join, note, applied_at"
    )
    .in("plan_id", planIds)
    .order("effective_on", { ascending: true })
    .order("created_at", { ascending: true });

  if (scheduledRes.error && isMissingScheduledUpdatesTable(scheduledRes.error)) {
    scheduledUpdatesFeatureUnavailable = true;
  }

  const scheduledUpdatesByPlan = new Map<string, ScheduledUpdateRow[]>();
  if (!scheduledRes.error) {
    (scheduledRes.data ?? []).forEach((u: any) => {
      const key = String(u.plan_id);
      const arr = scheduledUpdatesByPlan.get(key) ?? [];
      arr.push(u as ScheduledUpdateRow);
      scheduledUpdatesByPlan.set(key, arr);
    });
  } else if (!isMissingScheduledUpdatesTable(scheduledRes.error)) {
    console.error("Could not load scheduled updates:", scheduledRes.error);
  }

  const { data: settingRow } = await admin
    .from("app_settings")
    .select("int_value")
    .eq("key", "points_per_checkin")
    .maybeSingle();

  const pointsPerCheckin = Number(settingRow?.int_value ?? 1);

  async function savePoints(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const val = Number(formData.get("points") ?? 1);
    const intVal = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 1;

    const { error } = await admin
      .from("app_settings")
      .upsert({ key: "points_per_checkin", int_value: intVal }, { onConflict: "key" });

    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=points");
  }

  async function savePlan(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const planId = String(formData.get("plan_id") ?? "").trim();
    if (!planId) redirect("/more/rewards?err=Missing%20plan%20id");

    const payload = {
      grants_access: formData.get("grants_access") === "on",
      discount_food: pctToDb(formData.get("discount_food")),
      discount_spa: pctToDb(formData.get("discount_spa")),
      discount_giftshop: pctToDb(formData.get("discount_giftshop")),
      discount_watersports: pctToDb(formData.get("discount_watersports")),
      visible_on_join: formData.get("visible_on_join") === "on",
    };

    let { error } = await admin.from("membership_plans").update(payload).eq("id", planId);
    if (error && /visible_on_join/i.test(String(error.message || ""))) {
      const fallback = await admin
        .from("membership_plans")
        .update({
          grants_access: payload.grants_access,
          discount_food: payload.discount_food,
          discount_spa: payload.discount_spa,
          discount_giftshop: payload.discount_giftshop,
          discount_watersports: payload.discount_watersports,
        })
        .eq("id", planId);
      error = fallback.error;
    }

    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=plan");
  }

  async function schedulePlanUpdate(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const planId = String(formData.get("plan_id") ?? "").trim();
    const effectiveOn = String(formData.get("effective_on") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (!planId || !effectiveOn) {
      redirect("/more/rewards?err=Plan%20and%20effective%20date%20are%20required");
    }

    const payload = {
      plan_id: planId,
      effective_on: effectiveOn,
      discount_food: maybePctToDb(formData.get("discount_food")),
      discount_spa: maybePctToDb(formData.get("discount_spa")),
      discount_giftshop: maybePctToDb(formData.get("discount_giftshop")),
      discount_watersports: maybePctToDb(formData.get("discount_watersports")),
      grants_access: boolModeToValue(formData.get("grants_access_mode")),
      visible_on_join: boolModeToValue(formData.get("visible_on_join_mode")),
      note: note || null,
    };

    const { error } = await admin.from("membership_plan_scheduled_updates").insert(payload);
    if (error && isMissingScheduledUpdatesTable(error)) {
      redirect("/more/rewards?err=Run%20the%20latest%20migration%20to%20enable%20scheduled%20updates");
    }
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=scheduled");
  }

  async function deleteScheduledUpdate(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const scheduleId = String(formData.get("schedule_id") ?? "").trim();
    if (!scheduleId) redirect("/more/rewards?err=Missing%20scheduled%20update%20id");

    const { error } = await admin.from("membership_plan_scheduled_updates").delete().eq("id", scheduleId);
    if (error && isMissingScheduledUpdatesTable(error)) {
      redirect("/more/rewards?err=Run%20the%20latest%20migration%20to%20enable%20scheduled%20updates");
    }
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=schedule_removed");
  }

  async function addBenefit(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const planId = String(formData.get("plan_id") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    const value = String(formData.get("value") ?? "").trim();
    const sortOrderRaw = Number(formData.get("sort_order") ?? 100);
    const sortOrder = Number.isFinite(sortOrderRaw) ? Math.max(0, Math.floor(sortOrderRaw)) : 100;

    if (!planId || !label) {
      redirect("/more/rewards?err=Plan%20and%20benefit%20label%20are%20required");
    }

    const { error } = await admin.from("membership_plan_benefits").insert({
      plan_id: planId,
      label,
      value: value || "",
      sort_order: sortOrder,
      is_active: true,
    });

    if (error && isMissingBenefitsTable(error)) {
      redirect("/more/rewards?err=Run%20the%20latest%20migration%20to%20enable%20custom%20benefits");
    }
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=benefit_added");
  }

  async function updateBenefit(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const benefitId = String(formData.get("benefit_id") ?? "").trim();
    const label = String(formData.get("label") ?? "").trim();
    const value = String(formData.get("value") ?? "").trim();
    const sortOrderRaw = Number(formData.get("sort_order") ?? 100);
    const sortOrder = Number.isFinite(sortOrderRaw) ? Math.max(0, Math.floor(sortOrderRaw)) : 100;
    const isActive = formData.get("is_active") === "on";

    if (!benefitId || !label) {
      redirect("/more/rewards?err=Benefit%20label%20is%20required");
    }

    const { error } = await admin
      .from("membership_plan_benefits")
      .update({
        label,
        value: value || "",
        sort_order: sortOrder,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", benefitId);

    if (error && isMissingBenefitsTable(error)) {
      redirect("/more/rewards?err=Run%20the%20latest%20migration%20to%20enable%20custom%20benefits");
    }
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=benefit_saved");
  }

  async function setBenefitActive(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const benefitId = String(formData.get("benefit_id") ?? "").trim();
    const activeRaw = String(formData.get("next_active") ?? "").trim();
    const nextActive = activeRaw === "1";
    if (!benefitId) redirect("/more/rewards?err=Missing%20benefit%20id");

    const { error } = await admin
      .from("membership_plan_benefits")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", benefitId);

    if (error && isMissingBenefitsTable(error)) {
      redirect("/more/rewards?err=Run%20the%20latest%20migration%20to%20enable%20custom%20benefits");
    }
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect(`/more/rewards?ok=${nextActive ? "benefit_restored" : "benefit_removed"}`);
  }

  async function deleteBenefit(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const benefitId = String(formData.get("benefit_id") ?? "").trim();
    if (!benefitId) redirect("/more/rewards?err=Missing%20benefit%20id");

    const { error } = await admin.from("membership_plan_benefits").delete().eq("id", benefitId);
    if (error && isMissingBenefitsTable(error)) {
      redirect("/more/rewards?err=Run%20the%20latest%20migration%20to%20enable%20custom%20benefits");
    }
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=benefit_deleted");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Rewards Manager</h1>
          <p className="text-sm opacity-70">Update discounts, points, and custom plan benefits.</p>
        </div>
        <Link href="/more" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Back to More
        </Link>
      </div>

      {sp.ok ? (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          Saved.
        </div>
      ) : null}

      {sp.err ? (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {sp.err}
        </div>
      ) : null}
      {benefitsFeatureUnavailable ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Custom benefits are temporarily unavailable. Run the latest database migration to enable them.
        </div>
      ) : null}
      {!joinVisibilityFieldAvailable ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Join visibility toggle is temporarily unavailable. Run the latest migration to enable it.
        </div>
      ) : null}
      {scheduledUpdatesFeatureUnavailable ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Scheduled updates are temporarily unavailable. Run the latest migration to enable them.
        </div>
      ) : null}

      <div className="oura-card p-4">
        <div className="font-medium">Loyalty points</div>
        <p className="mt-1 text-sm opacity-70">Points awarded for each check-in.</p>

        <form action={savePoints} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            name="points"
            type="number"
            min={0}
            defaultValue={pointsPerCheckin}
            className="w-28 rounded border px-3 py-2"
          />
          <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Save points</button>
        </form>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="opacity-70">Benefits view:</span>
        <Link
          href="/more/rewards?benefit_view=active"
          className={["rounded border px-2 py-1", benefitView === "active" ? "font-medium" : "opacity-80"].join(" ")}
        >
          Active
        </Link>
        <Link
          href="/more/rewards?benefit_view=inactive"
          className={["rounded border px-2 py-1", benefitView === "inactive" ? "font-medium" : "opacity-80"].join(" ")}
        >
          Inactive
        </Link>
        <Link
          href="/more/rewards?benefit_view=all"
          className={["rounded border px-2 py-1", benefitView === "all" ? "font-medium" : "opacity-80"].join(" ")}
        >
          All
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {plans.map((p) => {
          const planBenefitsAll = benefitsByPlan.get(p.id) ?? [];
          const planBenefits =
            benefitView === "all"
              ? planBenefitsAll
              : planBenefitsAll.filter((b) => (benefitView === "active" ? b.is_active : !b.is_active));
          return (
            <div key={p.id} className="oura-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{p.name}</h2>
                  <p className="text-xs opacity-70">
                    Code: {p.code} • Price: ${Number(p.price ?? 0).toFixed(2)} • Duration: {p.duration_days ?? 0} day(s)
                  </p>
                </div>
                <span className="rounded border px-2 py-1 text-xs opacity-70">
                  {p.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <form action={savePlan} className="mt-3 grid grid-cols-2 gap-2">
                <input type="hidden" name="plan_id" value={p.id} />

                <label className="space-y-1 text-sm">
                  <span className="opacity-70">Restaurant (%)</span>
                  <input
                    name="discount_food"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={pctFromDb(p.discount_food)}
                    className="w-full rounded border px-2 py-2"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="opacity-70">Spa (%)</span>
                  <input
                    name="discount_spa"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={pctFromDb(p.discount_spa)}
                    className="w-full rounded border px-2 py-2"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="opacity-70">Gift shop (%)</span>
                  <input
                    name="discount_giftshop"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={pctFromDb(p.discount_giftshop)}
                    className="w-full rounded border px-2 py-2"
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="opacity-70">Watersports (%)</span>
                  <input
                    name="discount_watersports"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={pctFromDb(p.discount_watersports)}
                    className="w-full rounded border px-2 py-2"
                  />
                </label>

                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input
                    name="grants_access"
                    type="checkbox"
                    defaultChecked={!!p.grants_access}
                  />
                  <span>Plan includes facility access</span>
                </label>

                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input
                    name="visible_on_join"
                    type="checkbox"
                    defaultChecked={p.visible_on_join !== false}
                    disabled={!joinVisibilityFieldAvailable}
                  />
                  <span>Visible on public Join form</span>
                </label>

                <div className="col-span-2">
                  <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Save plan rewards</button>
                </div>
              </form>

              <div className="mt-4 border-t pt-3">
                <div className="font-medium">Schedule future change</div>
                <p className="text-xs opacity-70">Set changes now and they apply automatically on the effective date (Jamaica time).</p>
                <form action={schedulePlanUpdate} className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <label className="space-y-1 text-xs opacity-90">
                    <span className="opacity-70">Effective date</span>
                    <input name="effective_on" type="date" className="w-full rounded border px-2 py-2 text-sm" required />
                  </label>
                  <label className="space-y-1 text-xs opacity-90">
                    <span className="opacity-70">Restaurant (%)</span>
                    <input name="discount_food" type="number" min={0} max={100} placeholder="Keep current" className="w-full rounded border px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs opacity-90">
                    <span className="opacity-70">Spa (%)</span>
                    <input name="discount_spa" type="number" min={0} max={100} placeholder="Keep current" className="w-full rounded border px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs opacity-90">
                    <span className="opacity-70">Gift shop (%)</span>
                    <input name="discount_giftshop" type="number" min={0} max={100} placeholder="Keep current" className="w-full rounded border px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs opacity-90">
                    <span className="opacity-70">Watersports (%)</span>
                    <input name="discount_watersports" type="number" min={0} max={100} placeholder="Keep current" className="w-full rounded border px-2 py-2 text-sm" />
                  </label>
                  <label className="space-y-1 text-xs opacity-90">
                    <span className="opacity-70">Facility access</span>
                    <select name="grants_access_mode" className="w-full rounded border px-2 py-2 text-sm" defaultValue="keep">
                      <option value="keep">Keep current</option>
                      <option value="yes">Set to yes</option>
                      <option value="no">Set to no</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs opacity-90">
                    <span className="opacity-70">Join visibility</span>
                    <select
                      name="visible_on_join_mode"
                      className="w-full rounded border px-2 py-2 text-sm"
                      defaultValue="keep"
                      disabled={!joinVisibilityFieldAvailable}
                    >
                      <option value="keep">Keep current</option>
                      <option value="yes">Visible on join</option>
                      <option value="no">Hide from join</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs opacity-90 md:col-span-2">
                    <span className="opacity-70">Note (optional)</span>
                    <input name="note" className="w-full rounded border px-2 py-2 text-sm" placeholder="Why this change is scheduled" />
                  </label>
                  <button
                    disabled={scheduledUpdatesFeatureUnavailable}
                    className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Schedule update
                  </button>
                </form>

                <div className="mt-3 space-y-2">
                  {(scheduledUpdatesByPlan.get(p.id) ?? []).length === 0 ? (
                    <div className="text-sm opacity-70">No scheduled updates for this plan.</div>
                  ) : (
                    (scheduledUpdatesByPlan.get(p.id) ?? []).map((u) => (
                      <form key={u.id} action={deleteScheduledUpdate} className="rounded border p-2 text-sm">
                        <input type="hidden" name="schedule_id" value={u.id} />
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium">
                              Effective: {u.effective_on} {u.applied_at ? "• Applied" : "• Pending"}
                            </div>
                            <div className="mt-1 text-xs opacity-80">
                              {[
                                u.discount_food !== null ? `Restaurant ${pctFromDb(u.discount_food)}%` : "",
                                u.discount_spa !== null ? `Spa ${pctFromDb(u.discount_spa)}%` : "",
                                u.discount_giftshop !== null ? `Gift ${pctFromDb(u.discount_giftshop)}%` : "",
                                u.discount_watersports !== null ? `Watersports ${pctFromDb(u.discount_watersports)}%` : "",
                                u.grants_access === null ? "" : u.grants_access ? "Access: yes" : "Access: no",
                                u.visible_on_join === null ? "" : u.visible_on_join ? "Join: visible" : "Join: hidden",
                              ]
                                .filter(Boolean)
                                .join(" • ") || "No field changes"}
                            </div>
                            {u.note ? <div className="mt-1 text-xs opacity-70">Note: {u.note}</div> : null}
                          </div>
                          {!u.applied_at ? (
                            <button className="rounded border border-red-300 px-2 py-1 text-xs hover:bg-red-950/20">
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </form>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 border-t pt-3">
                <div className="font-medium">Custom benefits for this plan</div>
                <p className="text-xs opacity-70">These appear on the member Benefits screen.</p>
                <p className="text-xs opacity-60">Display order: lower numbers appear first.</p>
                <p className="text-xs opacity-60">Value examples: <span className="font-medium">15% off</span>, <span className="font-medium">2 free passes</span>, or leave blank for <span className="font-medium">Included</span>.</p>

                <form action={addBenefit} className="mt-2 grid grid-cols-1 items-end gap-2 md:grid-cols-12">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <label className="space-y-1 text-xs opacity-90 md:col-span-3">
                    <span className="opacity-70">Benefit label</span>
                    <input
                      name="label"
                      placeholder="e.g., Cabana"
                      className="w-full rounded border px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs opacity-90 md:col-span-3">
                    <span className="opacity-70">Benefit value (optional)</span>
                    <input
                      name="value"
                      placeholder="e.g., 15% off"
                      className="w-full rounded border px-2 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1 text-xs opacity-90 md:col-span-3">
                    <span className="opacity-70">Display Order</span>
                    <input
                      name="sort_order"
                      type="number"
                      aria-label="Display order"
                      title="Display order"
                      defaultValue={100}
                      className="w-full rounded border px-2 py-2 text-sm"
                    />
                  </label>
                  <button
                    disabled={benefitsFeatureUnavailable}
                    className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 md:col-span-3"
                  >
                    Add benefit
                  </button>
                </form>

                <div className="mt-3 space-y-2">
                  {planBenefits.length === 0 ? (
                    <div className="text-sm opacity-70">No custom benefits yet.</div>
                  ) : (
                    planBenefits.map((b) => (
                      <div key={b.id} className="rounded border p-2">
                        <form action={updateBenefit} className="grid grid-cols-1 gap-2 md:grid-cols-12">
                          <input type="hidden" name="benefit_id" value={b.id} />
                          <input
                            name="label"
                            defaultValue={b.label}
                            className="rounded border px-2 py-2 text-sm md:col-span-3"
                          />
                          <input
                            name="value"
                            defaultValue={b.value}
                            placeholder="Included (leave blank)"
                            className="rounded border px-2 py-2 text-sm md:col-span-3"
                          />
                          <label className="space-y-1 text-xs opacity-90 md:col-span-3">
                            <span className="opacity-70">Display Order</span>
                            <input
                              name="sort_order"
                              type="number"
                              defaultValue={b.sort_order}
                              aria-label="Display order"
                              title="Display order"
                              className="w-full rounded border px-2 py-2 text-sm"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-sm md:col-span-3">
                            <input name="is_active" type="checkbox" defaultChecked={b.is_active} />
                            <span>Active</span>
                          </label>
                          <div className="md:col-span-12">
                            <button
                              disabled={benefitsFeatureUnavailable}
                              className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Save benefit
                            </button>
                          </div>
                        </form>

                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {b.is_active ? (
                            <form action={setBenefitActive}>
                              <input type="hidden" name="benefit_id" value={b.id} />
                              <input type="hidden" name="next_active" value="0" />
                              <button
                                disabled={benefitsFeatureUnavailable}
                                className="rounded border border-amber-300 px-3 py-2 text-sm hover:bg-amber-950/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Mark inactive
                              </button>
                            </form>
                          ) : (
                            <form action={setBenefitActive}>
                              <input type="hidden" name="benefit_id" value={b.id} />
                              <input type="hidden" name="next_active" value="1" />
                              <button
                                disabled={benefitsFeatureUnavailable}
                                className="rounded border border-emerald-300 px-3 py-2 text-sm hover:bg-emerald-950/20 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Mark active
                              </button>
                            </form>
                          )}
                          {!b.is_active ? (
                            <form action={deleteBenefit}>
                              <input type="hidden" name="benefit_id" value={b.id} />
                              <button
                                disabled={benefitsFeatureUnavailable}
                                className="rounded border border-red-300 px-3 py-2 text-sm text-red-200 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Delete permanently
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
