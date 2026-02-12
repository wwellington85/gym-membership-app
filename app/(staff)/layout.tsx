import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomTabs } from "@/components/nav/bottom-tabs";
import { StaffTopbar } from "@/components/nav/staff-topbar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
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
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <>
      <div className="mx-auto w-full max-w-md h-svh overflow-y-auto overscroll-y-contain px-4 pt-4 pb-28">
        <StaffTopbar />
        <div className="mt-4 oura-shell p-4">{children}</div>
      </div>

      <BottomTabs role={staffProfile.role} />
    </>
  );
}
