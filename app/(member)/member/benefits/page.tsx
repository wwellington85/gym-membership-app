import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIERS, byCode, 
export default async function MemberBenefitsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/join");

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, membership_plans(code, name, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa)")
    .eq("member_id", member.id)
    .maybeSingle();

  const planRaw: any = (membership as any)?.membership_plans;
  const plan: any = Array.isArray(planRaw) ? planRaw[0] : planRaw;
  const current = byCode(plan?.code);

  function pct(n: any) {
    const v = Number(n ?? 0);
    const p = Math.round(v * 100);
    return `${p}% off`;
  }

  const currentDiscounts =
    plan && typeof plan === "object"
      ? [
          { label: "Restaurant & Bar", value: pct((plan as any).discount_food) },
          { label: "Spa services", value: pct((plan as any).discount_spa) },
          { label: "Gift shop", value: pct((plan as any).discount_giftshop) },
          { label: "Watersports", value: pct((plan as any).discount_watersports) },
          { label: "Complimentary high-speed Wi-Fi", value: "Included" },
        ]
      : current.discounts;


  // Load plan discounts for Compare tiers from DB (keeps UI copy but makes discounts source-of-truth)
  const tierCodes = compareTiers.map((t) => t.code);
  const { data: planRows } = await supabase
    .from("membership_plans")
    .select("code, discount_food, discount_watersports, discount_giftshop, discount_spa, grants_access")
    .in("code", tierCodes);

  const planByCode = new Map<string, any>();
  (planRows ?? []).forEach((r: any) => planByCode.set(String(r.code), r));

  function tierDiscountsFromPlanRow(row: any, fallback: any[]) {
    if (!row) return fallback;
    return [
      { label: "Restaurant & Bar", value: pct(row.discount_food) },
      { label: "Spa services", value: pct(row.discount_spa) },
      { label: "Gift shop", value: pct(row.discount_giftshop) },
      { label: "Watersports", value: pct(row.discount_watersports) },
      { label: "Complimentary high-speed Wi-Fi", value: "Included" },
    ];
  }

  const compareTiers = TIERS.map((t) => {
    const row = planByCode.get(t.code);
    return {
      ...t,
      // keep your existing labels/badges/access copy; just source discounts from DB if available
      discounts: tierDiscountsFromPlanRow(row, t.discounts),
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Benefits</h1>
          <p className="text-sm opacity-70">What your membership includes</p>
          <p className="mt-1 text-sm">
            <span className="opacity-70">Your plan:</span>{" "}
            <span className="font-medium">{current.name}</span>{" "}
            <span className="opacity-70">({current.priceLabel})</span>
          </p>
        </div>

        <BackButton fallbackHref="/member" />
      </div><div className="oura-card p-3">
        <div className="font-medium">Discounts</div>
        <p className="mt-1 text-sm opacity-70">
          Discounts may vary by event/promotions. Staff will confirm at checkout.
        </p>

        <div className="mt-3 divide-y divide-white/10">
          {currentDiscounts.map((d) => (
            <div key={d.label} className="flex items-center justify-between p-2 text-sm">
              <div className="opacity-80">{d.label}</div>
              <div className="font-medium">{d.value}</div>
            </div>
          ))}
        </div>

        


        {current.notes?.length ? (
          <div className="mt-3 oura-surface-muted p-3 text-sm">
            <div className="font-medium">Notes</div>
            <ul className="mt-1 list-disc pl-5 opacity-80">
              {current.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">Facility access</div>
        {current.access.length === 0 ? (
          <p className="mt-2 text-sm opacity-70">
            Your current plan doesn’t include facility access. Upgrade to unlock gym, pool, towels, lockers, and more.
          </p>
        ) : (
          <div className="mt-3 divide-y divide-white/10">
            {current.access.map((a) => (
              <div key={a} className="flex items-center justify-between p-2 text-sm">
                <div className="opacity-80">{a}</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <Link
            href="/member/settings?returnTo=/member/benefits"
            className="rounded border px-3 py-2 text-sm hover:oura-surface-muted"
          >
            Change plan
          </Link>
          <Link
            href="/member/card?returnTo=/member/benefits"
            className="rounded border px-3 py-2 text-sm hover:oura-surface-muted"
          >
            View card
          </Link>
        </div>
      </div>

      <div className="oura-card p-3">
        <div className="font-medium">Compare tiers</div>
        <p className="mt-1 text-sm opacity-70">
          Quick view of what changes when you upgrade.
        </p>

        <div className="mt-3 divide-y divide-white/10">
          {compareTiers.map((t) => {
            const isCurrent = t.code === current.code;
            return (
              <div
                key={t.code}
                className={[
                  "rounded border p-3",
                  isCurrent ? "oura-surface-muted" : "opacity-90",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">
                      {t.name}{" "}
                      {t.badge ? (
                        <span className="ml-2 text-xs opacity-70">• {t.badge}</span>
                      ) : null}
                    </div>
                    <div className="text-sm opacity-70">{t.priceLabel}</div>
                  </div>
                  {isCurrent ? (
                    <div className="text-xs font-medium opacity-70">Current</div>
                  ) : null}
                </div>

                <div className="mt-2 text-sm opacity-80">
                  <span className="opacity-70">Top discounts:</span>{" "}
                  {t.discounts.slice(0, 2).map((d) => d.value).join(" • ")}
                  {t.access.length ? (
                    <span className="ml-2 opacity-70">• Facility access</span>
                  ) : (
                    <span className="ml-2 opacity-70">• No access</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
