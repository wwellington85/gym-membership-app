import Link from "next/link";
import { effectiveBenefits } from "@/lib/access/benefits";
import {
  facilities,
  passIsActive,
  upcomingPass,
  type AccessPass,
  type AccessPlan,
} from "@/lib/access/rules";

type Benefit = ReturnType<typeof effectiveBenefits>[number];
export function UpgradeOptions({
  catalogue,
  benefits,
  active = true,
  localRewards = false,
  passes = [],
}: {
  catalogue: AccessPlan[];
  benefits: Benefit[];
  active?: boolean;
  localRewards?: boolean;
  passes?: AccessPass[];
}) {
  const now = new Date();
  const currentCodes = new Set(
    passes
      .filter(
        (pass) => passIsActive(pass, now) || upcomingPass([pass], now) !== null,
      )
      .map((pass) => pass.plan_snapshot.code),
  );
  // Current or scheduled monthly access already covers the highest Club plan.
  if (!active || currentCodes.has("club_monthly_95")) return null;
  const plans = catalogue.filter(
    (p) =>
      ["club_weekly", "club_monthly_95"].includes(p.code) &&
      p.grants_access &&
      p.price > 0 &&
      !currentCodes.has(p.code),
  );
  if (!active || !plans.length) return null;
  return (
    <section className="space-y-3" aria-label="Upgrade your membership">
      <h2 className="text-lg font-semibold">More time at Travellers.</h2>
      <p className="text-sm text-muted-foreground">
        Weekly or monthly facility access, with enhanced discounts.
      </p>
      {plans.length > 1 && (
        <p className="text-xs text-muted-foreground sm:hidden">
          Swipe to compare plans →
        </p>
      )}
      <div
        className="club-upgrade-carousel"
        data-single={plans.length === 1}
        role="region"
        aria-label="Club plans"
        tabIndex={0}
      >
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="oura-card flex min-w-0 flex-col gap-3 p-4"
          >
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
                if (rate <= 0) return null;
                return (
                  <li key={benefit.key}>
                    {benefit.label}: {rate}% off
                    {benefit.percent > 0 && rate !== benefit.percent && (
                      <span className="text-muted-foreground">
                        {" "}
                        · today {benefit.percent}%
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <Link
              href={`/member/upgrade?plan=${plan.code}`}
              className="club-button-secondary mt-auto self-start"
            >
              Explore {plan.duration_days === 7 ? "weekly" : "monthly"} plan
            </Link>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Benefits apply during pass dates. Discounts do not stack. Cabana rentals
        are separate.
      </p>
    </section>
  );
}
