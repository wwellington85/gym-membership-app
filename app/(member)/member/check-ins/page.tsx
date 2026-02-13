import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";

export default async function MemberCheckinsInfoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Check-ins</h1>
          <p className="text-sm opacity-70">
            Check in to earn points and track your activity.
          </p>
        </div>
        <BackButton fallbackHref="/member" />
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">How check-ins work</div>
        <div className="mt-2 space-y-3 text-sm opacity-85">
          <p>
            A check-in is a verified visit or interaction at a participating location.
            Most check-ins earn loyalty points.
          </p>
          <p>
            You can check in at different touch points depending on what you’re using —
            for example the gym, certain events, or other participating services.
          </p>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">Why it matters</div>
        <div className="mt-2 divide-y divide-white/10 text-sm">
          <div className="py-2 opacity-85">Earn points automatically over time</div>
          <div className="py-2 opacity-85">Track your progress and activity</div>
          <div className="py-2 opacity-85">Support tier progression (when enabled)</div>
        </div>
        <p className="mt-3 text-xs opacity-70">
          Availability of check-in locations may vary.
        </p>
      </div>
    </div>
  );
}
