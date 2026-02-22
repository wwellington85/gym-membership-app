import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberTabs } from "@/components/nav/member-tabs";
import { HistoryTracker } from "@/components/ui/history-tracker";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";
import { maybeRunAutoDowngradeToFree } from "@/lib/membership/auto-downgrade";

export default async function MemberGateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth/login?returnTo=/member");
  }

  try {
    await maybeRunAutoDowngradeToFree();
  } catch {
    // Non-blocking maintenance task; page should still render.
  }

  return (
    <>
      <div className="mx-auto w-full max-w-md h-svh overflow-y-auto overscroll-y-contain px-4 pt-6 pb-28">
        <InstallAppPrompt audience="member" />
        <div className="oura-shell p-4">
          <HistoryTracker />
          {children}
        </div>
      </div>

      {/* Fixed to viewport bottom */}
      <MemberTabs />
    </>
  );
}
