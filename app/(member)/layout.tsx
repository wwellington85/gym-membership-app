import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth/login?returnTo=/member");
  }

  return (
    <div className="min-h-svh bg-white">
      <div className="mx-auto max-w-md p-4 pb-24">{children}</div>
    </div>
  );
}
