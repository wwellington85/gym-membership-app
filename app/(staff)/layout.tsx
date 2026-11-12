import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomTabs } from "@/components/nav/bottom-tabs";
import { StaffTopbar } from "@/components/nav/staff-topbar";
import { HistoryTracker } from "@/components/ui/history-tracker";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import Link from "next/link";

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const STAFF_ROLES = new Set(["admin", "front_desk", "security"]);
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
  const isValidStaffRole = STAFF_ROLES.has(String(staffProfile.role ?? ""));
  if (!isValidStaffRole) {
    redirect("/member");
  }
  if (staffProfile.is_active === false) {
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  const isSecurity = staffProfile.role === "security";

  return (
    <>
      <aside
        className="staff-sidebar fixed bottom-0 left-0 top-[60px] z-30 hidden w-52 space-y-2 border-r border-white/10 bg-[rgb(8,10,20)] p-4 md:block"
        aria-label="Employee navigation"
      >
        {[
          ["/dashboard", "Overview"],
          ["/members", "Members"],
          ["/checkins/scan", "Verify member"],
          ["/checkins", "Gym visits"],
          ...(!isSecurity
            ? [
                ["/applications", "Requests"],
                ["/payments", "Payments"],
              ]
            : []),
          ...(staffProfile.role === "admin"
            ? [["/more", "Programme & admin"]]
            : []),
          ["/account", "My staff account"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="block rounded px-3 py-3 text-sm hover:bg-white/10"
          >
            {label}
          </Link>
        ))}
      </aside>
      <main
        id="main-content"
        className={[
          "w-full md:pl-52 h-svh overflow-y-auto overscroll-y-contain pt-[calc(env(safe-area-inset-top)+60px)] pb-28",
        ].join(" ")}
      >
        <HistoryTracker />
        <StaffTopbar role={staffProfile.role} />
        <InstallAppPrompt audience="staff" />
        <div
          className={[
            "mx-auto w-full",
            isSecurity ? "max-w-md px-4" : "max-w-6xl px-4 md:px-6",
          ].join(" ")}
        >
          <div
            className={["mt-4 oura-shell p-4", isSecurity ? "" : "md:p-5"].join(
              " ",
            )}
          >
            {children}
          </div>
        </div>
      </main>

      <BottomTabs role={staffProfile.role} />
    </>
  );
}
