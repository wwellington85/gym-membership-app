import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CreditCard, Gift, Dumbbell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadCatalogue } from "@/lib/access/server";
import { facilities } from "@/lib/access/rules";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (user) redirect("/auth/post-login");
  let plans: Awaited<ReturnType<typeof loadCatalogue>> = [];
  try {
    plans = await loadCatalogue();
  } catch {
    /* Sign-in stays available during a catalogue outage. */
  }
  const rewards = plans.find((plan) => plan.code === "rewards_free");
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="h-svh overflow-y-auto px-5 pb-10 pt-[max(24px,env(safe-area-inset-top))]"
    >
      <div className="mx-auto max-w-4xl">
        <header className="flex items-center justify-between gap-4 border-b pb-5">
          <div>
            <p className="club-wordmark">Travellers Club</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Travellers Beach Resort
            </p>
          </div>
          <Link href="/auth/login" className="club-button-secondary">
            Sign in
          </Link>
        </header>
        <div className="grid items-center gap-9 py-10 md:grid-cols-2 md:py-16">
          <section>
            <p className="club-eyebrow">Membership & rewards</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight">
              A little more,
              <br />
              every visit.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Your free Rewards membership, hotel benefits, and optional gym &
              resort access. All in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/join" className="club-button">
                Join free <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
              <Link href="/auth/login" className="club-button-secondary">
                Member sign in
              </Link>
            </div>
          </section>
          <div
            className="club-membership-card"
            aria-label="Travellers Club digital membership preview"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="club-card-brand">Travellers Club</span>
              <CreditCard size={25} aria-hidden="true" />
            </div>
            <div>
              <p className="club-card-name">
                Your membership.
                <br />
                Always with you.
              </p>
              <p className="mt-3 text-sm">Rewards, gym & resort access.</p>
            </div>
            <p className="club-eyebrow">Travellers Beach Resort</p>
          </div>
        </div>
        <section className="grid gap-5 border-y py-7 sm:grid-cols-2">
          <div>
            <Gift className="text-primary" size={23} aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">
              Benefits between visits
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your free membership stays with you. Show your digital card at
              participating outlets.
            </p>
            {rewards && (
              <p className="mt-3 text-sm">
                Restaurant & bar{" "}
                {Math.round(Number(rewards.discount_food ?? 0) * 100)}% · Spa{" "}
                {Math.round(Number(rewards.discount_spa ?? 0) * 100)}% · Gift
                shop {Math.round(Number(rewards.discount_giftshop ?? 0) * 100)}%
                · Watersports{" "}
                {Math.round(Number(rewards.discount_watersports ?? 0) * 100)}%
              </p>
            )}
          </div>
          <div>
            <Dumbbell className="text-primary" size={23} aria-hidden="true" />
            <h2 className="mt-3 text-lg font-semibold">
              Make room for your routine
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Choose gym-only access or a resort pass. Staying with us? Ask the
              front desk what your booking includes before buying.
            </p>
          </div>
        </section>
        <section className="py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">A pass for your visit</h2>
            <Link
              href="/auth/login?returnTo=/member/access"
              className="club-text-link"
            >
              Explore access <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {plans
              .filter(
                (plan) =>
                  plan.grants_access &&
                  plan.price > 0 &&
                  plan.duration_days < 3650,
              )
              .map((plan) => (
                <div key={plan.id} className="oura-card p-4">
                  <p className="club-eyebrow">
                    {plan.duration_days} calendar day
                    {plan.duration_days === 1 ? "" : "s"}
                  </p>
                  <h3 className="mt-2 font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {facilities(plan).join(" · ")}
                  </p>
                  <p className="mt-4 text-xl font-semibold">
                    ${Number(plan.price).toFixed(2)}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      USD
                    </span>
                  </p>
                </div>
              ))}
          </div>
        </section>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground">
          <p>Travellers Beach Resort · Travellers Club</p>
          <Link
            href="/auth/login?staff=1"
            className="inline-flex min-h-11 items-center underline"
          >
            Employee sign in
          </Link>
        </footer>
      </div>
    </main>
  );
}
