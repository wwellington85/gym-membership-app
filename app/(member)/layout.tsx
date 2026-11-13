import Link from "next/link";
import { CreditCard } from "lucide-react";
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
      <main id="main-content" tabIndex={-1} className="club-member-main">
        <header className="club-member-header">
          <Link href="/member">
            <span className="club-wordmark">Travellers Club</span>
            <p>Travellers Beach Resort</p>
          </Link>
          <Link
            href="/member/card"
            className="club-member-header-action"
            aria-label="Show my membership card"
          >
            <CreditCard size={21} aria-hidden="true" />
          </Link>
        </header>
        <div className="club-member-content">
          <InstallAppPrompt audience="member" />
          <MemberPageBack />
          {children}
        </div>
      </main>

      {/* Fixed to viewport bottom */}
      <MemberTabs />
    </>
  );
}
