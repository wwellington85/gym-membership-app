import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { titleCaseName } from "@/lib/format/name";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanPicker } from "@/components/member/plan-picker";

export const dynamic = "force-dynamic";

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtJamaicaDate(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "America/Jamaica" });
}

export default async function MemberSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/join");

  // Ensure we have a rewards_free plan to attach when membership row is missing
  const { data: rewardsPlan } = await supabase
    .from("membership_plans")
    .select("id, duration_days, code, name")
    .eq("code", "rewards_free")
    .maybeSingle();

  // Fetch membership row (include plan code + name)
  let { data: membership } = await supabase
    .from("memberships")
    .select("id, plan_id, paid_through_date, status, membership_plans(code, name)")
    .eq("member_id", member.id)
    .maybeSingle();

  // Create membership row if missing
  if (!membership) {
    const todayISO = new Date().toISOString().slice(0, 10);
    const duration = Number(rewardsPlan?.duration_days || 3650);
    const paidThrough = addDaysISO(todayISO, duration);

    await supabase.from("memberships").insert({
      member_id: member.id,
      plan_id: rewardsPlan?.id ?? null,
      start_date: todayISO,
      paid_through_date: paidThrough,
      status: "active",
    });

    const res = await supabase
      .from("memberships")
      .select("id, plan_id, paid_through_date, status, membership_plans(code, name)")
      .eq("member_id", member.id)
      .maybeSingle();

    membership = res.data ?? null;
  }

  const msPlanRaw: any = (membership as any)?.membership_plans;
  const msPlan: any = Array.isArray(msPlanRaw) ? msPlanRaw[0] : msPlanRaw;

  const currentPlanCode = String(msPlan?.code || "rewards_free");
  const currentPlanName = String(
    msPlan?.name || rewardsPlan?.name || "Travellers Rewards (Free)"
  );

  const paidThroughLabel = fmtJamaicaDate((membership as any)?.paid_through_date ?? null);

  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  async function savePlan(formData: FormData) {
    "use server";

    const planCode = String(formData.get("plan_code") || "");
    if (!planCode) redirect("/member/settings?err=SETTINGS_MISSING_PLAN");

    // Paid plans: go to upgrade page (Option B)
    if (planCode !== "rewards_free") {
      redirect(`/member/upgrade?plan=${encodeURIComponent(planCode)}`);
    }

    // Free plan: update membership directly
    const supabase = await createClient();

    const { data: plan } = await supabase
      .from("membership_plans")
      .select("id, duration_days")
      .eq("code", "rewards_free")
      .maybeSingle();

    const todayISO = new Date().toISOString().slice(0, 10);
    const duration = Number(plan?.duration_days || 3650);
    const paidThrough = addDaysISO(todayISO, duration);

    const { data: auth } = await supabase.auth.getUser();
    const actionUser = auth?.user;
    if (!actionUser) redirect("/auth/login");

    const { data: m } = await supabase
      .from("members")
      .select("id")
      .eq("user_id", actionUser.id)
      .maybeSingle();

    if (!m) redirect("/join");

    await supabase
      .from("memberships")
      .update({
        plan_id: plan?.id ?? null,
        status: "active",
        start_date: todayISO,
        paid_through_date: paidThrough,
        updated_at: new Date().toISOString(),
      })
      .eq("member_id", m.id);

    redirect("/member/settings?ok=Updated");
  }

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("code, name, price, duration_days, is_active")
    .eq("is_active", true)
    .order("price", { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm opacity-70">Signed in as</p>
          <p className="text-sm font-medium">{titleCaseName(member?.full_name) || "Member"}</p>
        </div>
        <BackButton fallbackHref="/member" />
      </div>

      <div className="space-y-3"><div className="oura-card p-3">
          <div className="font-medium">Membership plan</div>

          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <div className="opacity-70">Current plan</div>
              <div className="font-medium">{currentPlanName}</div>
            </div>
            <div>
              <div className="opacity-70">Paid through</div>
              <div className="font-medium">{paidThroughLabel}</div>
            </div>
          </div>
        </div>

        <div className="oura-card p-3">
          <div className="font-medium">Choose a plan</div>
          <p className="mt-1 text-sm opacity-70">
            Paid plans will take you to secure checkout.
          </p>

          <form action={savePlan} className="mt-3 space-y-3">
            <PlanPicker
              name="plan_code"
              defaultValue={currentPlanCode as any}
              currentPlan={currentPlanCode as any}
                  showSubmit
              submitLabel="Continue"
            />
</form>
        </div>


        <Link
          href="/auth/update-password"
          className="block rounded border px-3 py-2 text-sm hover:oura-surface-muted"
        >
          Change password
        </Link>

        <form action={logout}>
          <button className="w-full rounded border px-3 py-2 text-sm hover:oura-surface-muted">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
