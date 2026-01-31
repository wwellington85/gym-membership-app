export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage({
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

  async function changePassword(formData: FormData) {
    "use server";
    const supabase = await createClient();

    const password = String(formData.get("password") || "");
    const confirm = String(formData.get("confirm") || "");

    if (password.length < 8) redirect("/account?err=Password%20must%20be%20at%20least%208%20characters");
    if (password !== confirm) redirect("/account?err=Passwords%20do%20not%20match");

    const { error } = await supabase.auth.updateUser({ password });
    if (error) redirect(`/account?err=${encodeURIComponent(error.message)}`);

    redirect("/account?saved=1");
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
        <h1 className="text-xl font-semibold">Account</h1>
        <p className="text-sm opacity-70">
          {user.email} • role: {staffProfile.role}
        </p>
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

      <div className="rounded border p-3">
        <div className="font-medium">Change password</div>
        <div className="text-sm opacity-70">Minimum 8 characters</div>

        <form action={changePassword} className="mt-3 space-y-2">
          <input
            name="password"
            type="password"
            className="w-full rounded border px-3 py-2"
            placeholder="New password"
            required
          />
          <input
            name="confirm"
            type="password"
            className="w-full rounded border px-3 py-2"
            placeholder="Confirm new password"
            required
          />
          <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Update password
          </button>
        </form>
      </div>

      <div className="rounded border p-3">
        <div className="font-medium">Session</div>
        <form action={logoutAction} className="mt-3">
          <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50" type="submit">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
