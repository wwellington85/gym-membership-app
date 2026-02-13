import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackButton } from "@/components/ui/back-button";

export const dynamic = "force-dynamic";

export default async function MemberTierInfoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tier Level</h1>
          <p className="text-sm opacity-70">
            Higher tiers unlock better discounts and benefits.
          </p>
        </div>
        <BackButton fallbackHref="/member" />
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">How tiers work</div>
        <div className="mt-2 space-y-3 text-sm opacity-85">
          <p>
            Your tier reflects the level of benefits available to you. Generally, higher tiers
            can unlock stronger discounts and perks.
          </p>
          <p>
            All tiers aside from the free plan include full facility access — including the gym,
            pool, lounge, showers, lockers, and more.
          </p>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">Want to compare benefits?</div>
        <p className="mt-2 text-sm opacity-80">
          You can view the discounts and facility access for your plan on the Benefits page.
        </p>
        <div className="mt-3">
          <a
            className="inline-flex rounded border px-3 py-2 text-sm hover:oura-surface-muted"
            href="/member/benefits"
          >
            View benefits
          </a>
        </div>
      </div>
    </div>
  );
}
