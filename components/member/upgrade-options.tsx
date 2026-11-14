import Link from "next/link";
import { effectiveBenefits } from "@/lib/access/benefits";
import { facilities, type AccessPlan } from "@/lib/access/rules";

type Benefit = ReturnType<typeof effectiveBenefits>[number];
export function UpgradeOptions({
  catalogue,
  benefits,
  active = true,
  localRewards = false,
}: {
  catalogue: AccessPlan[];
  benefits: Benefit[];
  active?: boolean;
  localRewards?: boolean;
}) {
  const plans = catalogue.filter(
    (p) =>
      ["club_weekly", "club_monthly_95"].includes(p.code) &&
      p.grants_access &&
      p.price > 0,
  );
  if (!active || !plans.length) return null;
  return (
    <section className="space-y-3" aria-label="Upgrade your membership">
      <h2 className="text-lg font-semibold">More time at Travellers.</h2>
      <p className="text-sm text-muted-foreground">
        Explore weekly and monthly Club plans for facility access and enhanced
        discounts. Choose your dates before checkout.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className="oura-card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">{plan.name}</h3>
              <span className="text-sm font-medium">
                ${Number(plan.price).toFixed(2)} USD
              </span>
            </div>
            <p className="text-sm">
              {plan.duration_days} calendar days ·{" "}
              {facilities(plan).join(" · ")}
            </p>
            <ul className="space-y-1 text-sm">
              {benefits.map((benefit) => {
                const base = localRewards
                  ? Number(
                      catalogue.find((p) => p.code === "rewards_free")?.[
                        benefit.key
                      ] ?? 0,
                    )
                  : 0;
                const rate = Math.round(
                  Math.max(base, Number(plan[benefit.key] ?? 0)) * 100,
                );
                const extra = rate - benefit.percent;
                return (
                  <li key={benefit.key}>
                    {benefit.label}: {rate}% off
                    {extra > 0 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {extra} percentage points more than today
                      </span>
                    ) : extra < 0 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · currently {benefit.percent}% with your active pass
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Paid benefits apply during your pass dates. Discounts do not add
              together. Cabana rentals are separate.
            </p>
            <Link
              href={`/member/upgrade?plan=${plan.code}`}
              className="club-button-secondary"
            >
              Explore {plan.duration_days === 7 ? "weekly" : "monthly"} plan
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
