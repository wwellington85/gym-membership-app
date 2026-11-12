import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MemberTabs } from "@/components/nav/member-tabs";
import { HistoryTracker } from "@/components/ui/history-tracker";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";

export default async function MemberGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth/login?returnTo=/member");
  }

  return (
    <>
      <main
        id="main-content"
        className="mx-auto w-full max-w-2xl h-svh overflow-y-auto overscroll-y-contain px-4 pt-6 pb-28"
      >
        <InstallAppPrompt audience="member" />
        <div className="sm:oura-shell sm:p-5">
          <HistoryTracker />
          {children}
        </div>
      </main>

      {/* Fixed to viewport bottom */}
      <MemberTabs />
    </>
  );
}
