import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(v: any) {
  const n = Number(v ?? 0);
  return n.toFixed(2);
}

export default async function UpgradePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/join");

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("id, code, name, price, duration_days, plan_type, grants_access")
    .eq("is_active", true)
    .neq("code", "rewards_free")
    .order("price", { ascending: true });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Upgrade membership</h1>
          <p className="text-sm opacity-70">Choose a plan for full access.</p>
        </div>
        <Link href="/member" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Back
        </Link>
      </div>

      <div className="grid gap-3">
        {(plans ?? []).map((p: any) => (
          <div key={p.id} className="rounded border p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm opacity-70">
                  {p.duration_days} day{p.duration_days === 1 ? "" : "s"} • ${money(p.price)}
                </div>
              </div>

              <form action={`/api/fygaro/checkout?plan=${encodeURIComponent(p.code)}`} method="POST">
                <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
                  Continue to payment
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded border bg-gray-50 p-3 text-sm">
        After payment, your membership activates automatically.
      </div>
    </div>
  );
}
