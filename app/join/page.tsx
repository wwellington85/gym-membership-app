import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RewardsSignup } from "@/components/join/rewards-signup";

import { GoogleSignIn } from "@/components/google-sign-in";
import { googleSignInEnabled } from "@/lib/auth/google";

export default async function JoinPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (user) redirect("/auth/post-login");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Join Travellers Club.</h1>
      <p className="text-muted-foreground">
        Join free for your digital membership card and hotel benefits.
      </p>
      {googleSignInEnabled() && <GoogleSignIn />}
      <RewardsSignup />
    </div>
  );
}
