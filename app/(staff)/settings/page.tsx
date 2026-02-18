export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ saved?: string; err?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");

  const role = staffProfile.role as string;

  // Load current points per check-in (default 1)
  const { data: settingRow } = await supabase
    .from("app_settings")
    .select("int_value")
    .eq("key", "points_per_checkin")
    .maybeSingle();

  const points = settingRow?.int_value ?? 1;

  async function savePoints(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const val = Number(formData.get("points") ?? 1);
    const intVal = Number.isFinite(val) ? Math.max(0, Math.floor(val)) : 1;

    const { error } = await supabase.from("app_settings").upsert(
      { key: "points_per_checkin", int_value: intVal },
      { onConflict: "key" }
    );

    if (error) redirect(`/settings?err=${encodeURIComponent(error.message)}`);
    redirect("/settings?saved=1");
  }

  async function logoutAction() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm opacity-70">Manage app preferences</p>

        <form action={logoutAction}>
          <button className="mt-3 rounded border px-3 py-2 text-sm hover:bg-gray-50" type="submit">
            Log out
          </button>
        </form>
      </div>

      {sp.saved === "1" ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          Saved.
        </div>
      ) : null}

      {sp.err ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
          Error: {sp.err}
        </div>
      ) : null}

      {role === "admin" ? (
        <div className="oura-card p-3">
          <div className="font-medium">Staff Management</div>
          <div className="text-sm opacity-70">Invite staff and assign roles</div>
          <Link className="mt-2 inline-block underline underline-offset-2" href="/settings/staff">
            Open Staff Management
          </Link>
          <div className="mt-3 text-sm opacity-70">Need to update discounts or package perks?</div>
          <Link className="mt-1 inline-block underline underline-offset-2" href="/more/rewards">
            Open Rewards Manager
          </Link>
        </div>
      ) : null}

      <div className="oura-card p-3">
        <div className="font-medium">Loyalty</div>
        <div className="text-sm opacity-70">Points earned per gym check-in</div>

        <form action={savePoints} className="mt-3 flex items-center gap-2">
          <input
            name="points"
            type="number"
            min={0}
            defaultValue={points}
            className="w-28 rounded border px-3 py-2"
          />
          <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Save
          </button>
        </form>

        <div className="mt-2 text-xs opacity-60">
          Example: if set to 2, each check-in adds 2 points.
        </div>
      </div>
    </div>
  );
}
