import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomTabs } from "@/components/nav/bottom-tabs";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");
  if (staffProfile.is_active === false) {
    // Optional: you can route to a nicer "account disabled" page later
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="min-h-screen pb-16">
      <main className="mx-auto w-full max-w-md px-4 py-4">{children}</main>
      <BottomTabs role={staffProfile.role} />
    </div>
  );
}
