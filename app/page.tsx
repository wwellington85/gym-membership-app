import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadCatalogue } from "@/lib/access/server";
import { facilities } from "@/lib/access/rules";

export const dynamic = "force-dynamic";
export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: staff } = await supabase
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    redirect(staff?.role ? "/dashboard" : "/member");
  }
  let plans: Awaited<ReturnType<typeof loadCatalogue>> = [];
  try {
    plans = await loadCatalogue();
  } catch {
    /* joining and sign-in remain available during a catalogue outage */
  }
  const rewards = plans.find((p) => p.code === "rewards_free");
  return (
    <main id="main-content" className="h-svh overflow-y-auto px-5 py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-widest">
            Travellers Beach Resort
          </p>
          <h1 className="text-4xl font-semibold">Welcome to Travellers Club</h1>
          <p className="text-lg opacity-80">
            Free Rewards membership, hotel perks, and optional gym & resort
            access.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/join"
              className="rounded border bg-indigo-500/30 px-5 py-3 font-medium"
            >
              Join free
            </Link>
            <Link href="/auth/login" className="rounded border px-5 py-3">
              Member sign in
            </Link>
          </div>
        </div>
        <section className="oura-card space-y-3 p-5">
          <h2 className="text-xl font-semibold">Your digital Rewards card</h2>
          <p>
            Show your card to staff to use your member benefits. Your membership
            continues between visits and after a paid pass ends.
          </p>
          {rewards && (
            <p className="text-sm opacity-80">
              Restaurant & bar{" "}
              {Math.round(Number(rewards.discount_food ?? 0) * 100)}% · Spa{" "}
              {Math.round(Number(rewards.discount_spa ?? 0) * 100)}% · Gift shop{" "}
              {Math.round(Number(rewards.discount_giftshop ?? 0) * 100)}% ·
              Watersports{" "}
              {Math.round(Number(rewards.discount_watersports ?? 0) * 100)}%
            </p>
          )}
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Optional access</h2>
          <p className="text-sm opacity-80">
            Staying at the hotel? Check what your booking includes with the
            front desk before purchasing.
          </p>
          {plans
            .filter(
              (p) => p.grants_access && p.price > 0 && p.duration_days < 3650,
            )
            .map((p) => (
              <div key={p.id} className="rounded border p-4">
                <h3 className="font-semibold">
                  {p.name} · ${Number(p.price).toFixed(2)} USD
                </h3>
                <p className="mt-2 text-sm">
                  {p.duration_days} calendar day
                  {p.duration_days === 1 ? "" : "s"} ·{" "}
                  {facilities(p).join(" · ")}
                </p>
              </div>
            ))}
          <Link
            href="/auth/login?returnTo=/member/access"
            className="inline-block rounded border px-4 py-3"
          >
            Sign in to explore passes
          </Link>
        </section>
        <Link
          href="/auth/login?staff=1"
          className="inline-block py-3 text-sm underline"
        >
          Employee sign in
        </Link>
      </div>
    </main>
  );
}
