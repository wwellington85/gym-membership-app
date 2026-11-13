import { randomUUID } from "crypto";
import { redirect } from "next/navigation";
import { loadCatalogue, loadAccess, requireMember } from "@/lib/access/server";
import { facilities } from "@/lib/access/rules";
import { jamaicaTodayYmd } from "@/lib/membership/status";
import { AccessPurchaseForm } from "@/components/member/access-purchase-form";

export const dynamic = "force-dynamic";

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; intent?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const { member } = await requireMember();
  if (!sp.plan) redirect("/member/access");
  const plans = await loadCatalogue();
  const plan = plans.find(
    (p) => p.code === sp.plan && p.grants_access && p.price > 0,
  );
  if (!plan)
    redirect("/member/access?err=This%20product%20is%20not%20available.");
  const { passes } = await loadAccess(member.id, member.is_active);
  const current =
    passes.find((p) => p.plan_id === plan.id && p.status === "active") ?? null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {sp.intent === "renew" ? "Renew access" : "Confirm access"}
      </h1>
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      {!member.is_active ? (
        <p role="alert">Please contact the front desk about your membership.</p>
      ) : (
        <>
          <div className="oura-card space-y-2 p-4">
            <h2 className="font-semibold">{plan.name}</h2>
            <p className="text-sm">{facilities(plan).join(" · ")}</p>
            {plan.code === "gym_day" && (
              <p className="text-sm text-muted-foreground">
                Gym only. Pool, beach chairs/towels, showers, lockers and lounge
                are not included.
              </p>
            )}
          </div>
          <AccessPurchaseForm
            plan={plan}
            current={current}
            today={jamaicaTodayYmd()}
            checkoutKey={randomUUID()}
            renew={sp.intent === "renew"}
          />
        </>
      )}
    </div>
  );
}
