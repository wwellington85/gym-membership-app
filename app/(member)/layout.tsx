import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function MemberGateLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect("/auth/login?returnTo=/member");
  }

  return (
    <>{children}</>
  );
}
