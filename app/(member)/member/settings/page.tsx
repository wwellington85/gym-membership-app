import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
    .select("id, duration_days, code")
    .eq("code", "rewards_free")
    .maybeSingle();

  // Fetch membership row (create if missing)
  let { data: membership } = await supabase
    .from("memberships")
    .select("id, plan_id, paid_through_date, status")
    .eq("member_id", member.id)
    .maybeSingle();

  if (!membership) {
    const todayISO = new Date().toISOString().slice(0, 10);
    const duration = Number(rewardsPlan?.duration_days || 3650);
    const paidThrough = addDaysISO(todayISO, duration);

    const { data: created } = await supabase
      .from("memberships")
      .insert({
        member_id: member.id,
        plan_id: rewardsPlan?.id ?? null,
        start_date: todayISO,
        paid_through_date: paidThrough,
        status: "active",
      })
      .select("id, plan_id, paid_through_date, status")
      .single();

    membership = created ?? null;
  }

  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  async function savePlan(formData: FormData) {
    "use server";

    const planCode = String(formData.get("plan_code") || "");
    if (!planCode) redirect("/member/settings?err=Missing%20plan");

    // Paid plans go to Fygaro checkout route (creates payment row + redirects to Fygaro)
    if (planCode !== "rewards_free") {
      redirect(`/api/fygaro/checkout?plan=${encodeURIComponent(planCode)}`);
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
          <p className="text-sm opacity-70">Manage your account</p>
        </div>
        <Link
          href="/member"
          prefetch={false}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="text-sm">
          <div className="opacity-70">Signed in as</div>
          <div className="font-medium">{user.email ?? "—"}</div>
        </div>

        <div className="rounded border p-3">
          <div className="font-medium">Membership plan</div>
          <p className="mt-1 text-sm opacity-70">
            Choose a plan. Paid plans will take you to secure checkout.
          </p>

          <form action={savePlan} className="mt-3 space-y-2">
            <select
              name="plan_code"
              className="w-full rounded border px-3 py-2 text-sm"
              defaultValue="rewards_free"
            >
              {(plans ?? []).map((p: any) => (
                <option key={p.code} value={p.code}>
                  {p.name} {Number(p.price) > 0 ? `- $${Number(p.price).toFixed(2)}` : ""}
                </option>
              ))}
            </select>

            <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Save plan
            </button>
          </form>
        </div>

        <Link
          href="/auth/update-password"
          className="block rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Change password
        </Link>

        <form action={logout}>
          <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
