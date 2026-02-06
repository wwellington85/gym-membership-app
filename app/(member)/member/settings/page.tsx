import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MemberSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  async function logout() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm opacity-70">Manage your account</p>
        </div>
        <Link href="/member" prefetch={false} className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Back
        </Link>
      </div>

      <div className="rounded border p-4 space-y-3">
        <div className="text-sm">
          <div className="opacity-70">Signed in as</div>
          <div className="font-medium">{user.email ?? "—"}</div>
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
