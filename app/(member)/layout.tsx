import { redirect } from "next/navigation";
import { memberLoginHref } from "@/lib/auth/member-login";
import { createClient } from "@/lib/supabase/server";
import { MemberTabs } from "@/components/nav/member-tabs";
import { MemberPageBack } from "@/components/nav/member-page-back";
import { InstallAppPrompt } from "@/components/pwa/install-app-prompt";

export default async function MemberGateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect(await memberLoginHref());
  }

  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-2xl h-svh overflow-y-auto overscroll-y-contain px-4 pt-6 pb-28"
      >
        <InstallAppPrompt audience="member" />
        <div className="sm:oura-shell sm:p-5">
          <MemberPageBack />
          {children}
        </div>
      </main>

      {/* Fixed to viewport bottom */}
      <MemberTabs />
    </>
  );
}
