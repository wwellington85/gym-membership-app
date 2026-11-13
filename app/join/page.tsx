import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RewardsSignup } from "@/components/join/rewards-signup";

export default async function JoinPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (user) redirect("/auth/post-login");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Join Travellers Club.</h1>
      <p className="text-muted-foreground">
        Your free digital membership for Travellers Beach Resort. Keep your
        benefits between visits, with your card always close at hand.
      </p>
      <RewardsSignup />
    </div>
  );
}
