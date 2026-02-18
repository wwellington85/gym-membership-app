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
};

type BenefitRow = {
  id: string;
  plan_id: string;
  label: string;
  value: string;
  sort_order: number;
  is_active: boolean;
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

export default async function RewardsManagerPage({
  searchParams,
}: {
  searchParams?: Promise<{ ok?: string; err?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  await requireAdminUser();

  const admin = createAdminClient();

  const { data: plansRows, error: plansErr } = await admin
    .from("membership_plans")
    .select(
      "id, code, name, price, duration_days, is_active, grants_access, discount_food, discount_spa, discount_giftshop, discount_watersports"
    )
    .order("price", { ascending: true });

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
    };

    const { error } = await admin.from("membership_plans").update(payload).eq("id", planId);
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=plan");
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

  async function removeBenefit(formData: FormData) {
    "use server";
    await requireAdminUser();

    const admin = createAdminClient();
    const benefitId = String(formData.get("benefit_id") ?? "").trim();
    if (!benefitId) redirect("/more/rewards?err=Missing%20benefit%20id");

    const { error } = await admin
      .from("membership_plan_benefits")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", benefitId);

    if (error && isMissingBenefitsTable(error)) {
      redirect("/more/rewards?err=Run%20the%20latest%20migration%20to%20enable%20custom%20benefits");
    }
    if (error) redirect(`/more/rewards?err=${encodeURIComponent(error.message)}`);
    redirect("/more/rewards?ok=benefit_removed");
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

      <div className="grid gap-4 xl:grid-cols-2">
        {plans.map((p) => {
          const planBenefits = benefitsByPlan.get(p.id) ?? [];
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

                <div className="col-span-2">
                  <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Save plan rewards</button>
                </div>
              </form>

              <div className="mt-4 border-t pt-3">
                <div className="font-medium">Custom benefits for this plan</div>
                <p className="text-xs opacity-70">These appear on the member Benefits screen.</p>
                <p className="text-xs opacity-60">Display order: lower numbers appear first.</p>
                <p className="text-xs opacity-60">Value examples: <span className="font-medium">15% off</span>, <span className="font-medium">2 free passes</span>, or leave blank for <span className="font-medium">Included</span>.</p>

                <form action={addBenefit} className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                  <input type="hidden" name="plan_id" value={p.id} />
                  <input
                    name="label"
                    placeholder="Benefit label"
                    className="rounded border px-2 py-2 text-sm"
                  />
                  <input
                    name="value"
                    placeholder="Benefit value (optional)"
                    className="rounded border px-2 py-2 text-sm"
                  />
                  <input
                    name="sort_order"
                    type="number"
                    aria-label="Display order"
                    title="Display order"
                    defaultValue={100}
                    placeholder="Display order"
                    className="rounded border px-2 py-2 text-sm"
                  />
                  <button
                    disabled={benefitsFeatureUnavailable}
                    className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add benefit
                  </button>
                </form>

                <div className="mt-3 space-y-2">
                  {planBenefits.length === 0 ? (
                    <div className="text-sm opacity-70">No custom benefits yet.</div>
                  ) : (
                    planBenefits.map((b) => (
                      <form key={b.id} action={updateBenefit} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-6">
                        <input type="hidden" name="benefit_id" value={b.id} />
                        <input
                          name="label"
                          defaultValue={b.label}
                          className="rounded border px-2 py-2 text-sm md:col-span-2"
                        />
                        <input
                          name="value"
                          defaultValue={b.value}
                          placeholder="Included (leave blank)"
                          className="rounded border px-2 py-2 text-sm md:col-span-2"
                        />
                        <input
                          name="sort_order"
                          type="number"
                          defaultValue={b.sort_order}
                          aria-label="Display order"
                          title="Display order"
                          className="rounded border px-2 py-2 text-sm"
                        />
                        <label className="flex items-center gap-2 text-sm">
                          <input name="is_active" type="checkbox" defaultChecked={b.is_active} />
                          <span>Active</span>
                        </label>
                        <div className="md:col-span-6 flex flex-wrap items-center gap-2">
                          <button
                            disabled={benefitsFeatureUnavailable}
                            className="rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Save benefit
                          </button>
                          <button
                            formAction={removeBenefit}
                            disabled={benefitsFeatureUnavailable}
                            className="rounded border border-red-300 px-3 py-2 text-sm text-red-200 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Remove benefit
                          </button>
                        </div>
                      </form>
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
