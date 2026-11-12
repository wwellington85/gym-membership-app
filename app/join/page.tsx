import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RewardsSignup } from "@/components/join/rewards-signup";

export default async function JoinPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (user) redirect("/auth/post-login");
  return (
    <div className="space-y-5 py-4">
      <Link href="/" className="inline-block py-2 text-sm underline">
        Travellers Club
      </Link>
      <h1 className="text-2xl font-semibold">Join Travellers Rewards</h1>
      <p className="opacity-80">
        Your free digital membership for Travellers Beach Resort. Keep your
        benefits between visits, with your card always close at hand.
      </p>
      <RewardsSignup />
    </div>
  );
}
