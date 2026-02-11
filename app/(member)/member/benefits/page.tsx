import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isAccessPlan(code?: string | null) {
  const c = (code ?? "").toLowerCase();
  return c.startsWith("club_");
}

export default async function BenefitsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Benefits</h1>
        <div className="rounded border p-3 text-sm">
          No membership profile linked yet.
          <div className="mt-2">
            <Link className="rounded border px-3 py-2 text-sm hover:oura-surface-muted" href="/join">
              Join Travellers Club
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("status, membership_plans(name, code)")
    .eq("member_id", member.id)
    .maybeSingle();

  const planRaw: any = (membership as any)?.membership_plans;
  const plan: any = Array.isArray(planRaw) ? planRaw[0] : planRaw;
  const access = isAccessPlan(plan?.code);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Benefits</h1>
          <p className="text-sm opacity-70">{plan?.name ?? "Travellers Rewards"}</p>
        </div>
        <Link href="/member" prefetch={false} className="rounded border px-3 py-2 text-sm hover:oura-surface-muted">
          Back
        </Link>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="text-sm">
          <div className="opacity-70">Membership status</div>
          <div className="font-medium">{membership?.status ?? "—"}</div>
        </div>

        <div className="rounded border oura-surface-muted p-3">
          <div className="font-medium">Discounts</div>
          <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
            <li>20% off food</li>
            <li>20% off watersports</li>
            <li>10% off gift shop</li>
            <li>15% off spa services</li>
          </ul>
        </div>

        <div className="rounded border oura-surface-muted p-3">
          <div className="font-medium">Facility access</div>
          {access ? (
            <ul className="mt-2 list-disc pl-5 text-sm space-y-1">
              <li>Gym access</li>
              <li>Family lounge room</li>
              <li>Pool + beach towels</li>
              <li>Lockers + shower access</li>
            </ul>
          ) : (
            <div className="mt-2 text-sm opacity-80">
              Rewards members receive discounts only. Upgrade to a Travellers Club pass for full access.
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Link href="/member/card" className="flex-1 rounded border px-3 py-2 text-center text-sm hover:oura-surface-muted">
            View card
          </Link>
          <Link href="/join" className="flex-1 rounded border px-3 py-2 text-center text-sm hover:oura-surface-muted">
            Change plan
          </Link>
        </div>
      </div>
    </div>
  );
}
