import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";

export default async function MemberPointsInfoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Loyalty Points</h1>
          <p className="text-sm opacity-70">
            Earn points when you check in and use eligible services.
          </p>
        </div>
        <BackButton fallbackHref="/member" />
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">How points work</div>
        <div className="mt-2 space-y-3 text-sm opacity-85">
          <p>
            Points are earned through verified activity (like check-ins at the gym or
            other participating touch points) and eligible spend.
          </p>
          <p>
            As your points build up, you can redeem them for rewards such as a free drink,
            a meal credit, or other perks (reward options may vary by season and promotions).
          </p>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">What you can redeem</div>
        <div className="mt-2 divide-y divide-white/10 text-sm">
          <div className="flex items-center justify-between py-2">
            <div className="opacity-80">Free drink</div>
            <div className="opacity-70">Example reward</div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="opacity-80">Meal credit</div>
            <div className="opacity-70">Example reward</div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="opacity-80">Exclusive perks</div>
            <div className="opacity-70">Seasonal</div>
          </div>
        </div>

        <p className="mt-3 text-xs opacity-70">
          Rewards and redemption thresholds can change. Staff will confirm availability.
        </p>
      </div>
    </div>
  );
}
