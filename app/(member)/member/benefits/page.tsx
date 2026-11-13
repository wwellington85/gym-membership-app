import Link from "next/link";
import { requireMember, loadAccess, loadCatalogue } from "@/lib/access/server";
import { effectiveBenefits } from "@/lib/access/benefits";

export const dynamic = "force-dynamic";
export default async function BenefitsPage() {
  const { member, admin } = await requireMember();
  const [access, catalogue] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(),
  ]);
  const free = catalogue.find((p) => p.code === "rewards_free");
  const benefits = effectiveBenefits(free, access.passes, member.is_active);
  const ids = free ? [free.id] : [];
  const { data: currentExtras, error } = ids.length
    ? await admin
        .from("membership_plan_benefits")
        .select("id, label, value")
        .in("plan_id", ids)
        .eq("is_active", true)
        .order("sort_order")
    : { data: [], error: null };
  const extras = [
    ...(currentExtras ?? []),
    ...access.current.flatMap((p) =>
      (p.plan_snapshot.benefits ?? []).map((b, i) => ({
        ...b,
        id: `${p.id}-${i}`,
      })),
    ),
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Your benefits.</h1>
      <Link
        href="/member/activity"
        className="inline-block py-2 underline text-sm"
      >
        View recorded benefit activity
      </Link>
      <p className="text-sm text-muted-foreground">
        Your Rewards benefits continue between visits. Any enhanced pass
        discounts apply only during its valid period. Discounts do not add
        together.
      </p>
      {!member.is_active ? (
        <p role="alert" className="oura-alert-warning">
          Please ask the front desk to verify your membership before using
          benefits.
        </p>
      ) : (
        <>
          <section className="divide-y divide-border">
            {benefits.map((benefit) => (
              <div
                key={benefit.key}
                className="club-rule-row"
              >
                <span>{benefit.label}</span>
                <strong className="shrink-0 text-2xl font-semibold tabular-nums">
                  {benefit.percent}% off
                </strong>
              </div>
            ))}
          </section>
          {extras?.length ? (
            <section className="space-y-2">
              <h2 className="font-semibold">Additional perks</h2>
              {extras.map((b) => (
                <div key={b.id} className="border-b py-3 text-sm">
                  {b.label} · {b.value || "Included"}
                </div>
              ))}
            </section>
          ) : null}
          {error && (
            <p role="status" className="text-sm">
              Additional perks could not be loaded. Please check with the front
              desk.
            </p>
          )}
          <div className="oura-card p-4 text-sm">
            <h2 className="font-semibold">How to use a benefit</h2>
            <p className="mt-2">
              Show your membership card to staff before the bill is prepared.
              Confirm any outlet-specific exclusions or event restrictions
              before ordering. Ask the front desk to resolve a benefit
              discrepancy.
            </p>
            <Link
              href="/member/card"
              className="club-button mt-3"
            >
              Show my card
            </Link>
          </div>
        </>
      )}
      <div className="text-sm">
        <h2 className="font-semibold">Gym & resort facilities</h2>
        <p className="mt-2 text-muted-foreground">
          Facility access is separate from Rewards membership. Your card shows
          access valid now.
        </p>
        <Link href="/member/access" className="inline-block py-3 underline">
          View or purchase access
        </Link>
      </div>
    </div>
  );
}
