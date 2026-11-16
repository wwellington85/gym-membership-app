import Link from "next/link";
import { loadCatalogue, loadAccess, requireMember } from "@/lib/access/server";
import { effectiveBenefits } from "@/lib/access/benefits";
import { facilities, passIsActive } from "@/lib/access/rules";
import { addDaysYmd, jamaicaTodayYmd } from "@/lib/membership/status";

export const dynamic = "force-dynamic";
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { member, admin } = await requireMember();
  const [catalogue, access, sp] = await Promise.all([
    loadCatalogue(),
    loadAccess(member.id, member.is_active),
    searchParams,
  ]);
  const { data: extensions } = await admin
    .from("access_pass_extensions")
    .select("pass_id, new_end_date")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Gym & resort access</h1>
      <p className="text-sm text-muted-foreground">
        Optional passes alongside your free Club account. Staying at the hotel?
        Ask the front desk what your room booking includes before buying.
      </p>
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      {!member.is_active && (
        <p role="alert">Your membership needs front desk assistance.</p>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold">My passes</h2>
        {access.passes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No passes yet. You can explore weekly, monthly or day passes below.
          </p>
        )}
        {access.passes.map((p) => (
          <div
            key={p.id}
            className="oura-card club-plan-card space-y-2 p-4"
            data-plan-code={p.plan_snapshot.code}
          >
            <h3 className="font-medium">{p.plan_snapshot.name}</h3>
            <p className="text-sm">
              {p.status === "revoked"
                ? "Revoked"
                : !member.is_active
                  ? "Unavailable while membership is inactive"
                  : passIsActive(p)
                    ? "Valid now"
                    : p.start_date > jamaicaTodayYmd()
                      ? "Upcoming"
                      : "Ended"}{" "}
              · {p.start_date} — {p.paid_through_date}
            </p>
            <p className="text-sm text-muted-foreground">
              {facilities(p.plan_snapshot).join(" · ")} · Ends at 10 pm.
            </p>
            {extensions?.some((e) => e.pass_id === p.id) && (
              <p className="text-sm text-muted-foreground">
                Complimentary extension included in the expiration date above.
              </p>
            )}
            {member.is_active &&
              passIsActive(p) &&
              p.paid_through_date <= addDaysYmd(jamaicaTodayYmd(), 3) && (
                <p className="text-sm font-medium">
                  This pass ends soon. Your free Club account will continue.
                </p>
              )}
            {member.is_active && p.status === "active" && (
              <Link
                className="inline-block rounded border px-3 py-2 text-sm"
                href={`/member/upgrade?plan=${p.plan_snapshot.code}&intent=renew`}
              >
                Renew this product
              </Link>
            )}
          </div>
        ))}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold" id="explore-passes">
          Explore passes
        </h2>
        {catalogue
          .filter(
            (p) => p.grants_access && p.price > 0 && p.duration_days < 3650,
          )
          .map((p) => (
            <div
              key={p.id}
              className="oura-card club-plan-card space-y-3 p-4"
              data-plan-code={p.code}
            >
              <div className="flex justify-between gap-3">
                <h3 className="font-semibold">{p.name}</h3>
                <span className="whitespace-nowrap">
                  ${Number(p.price).toFixed(2)} USD
                </span>
              </div>
              <p className="text-sm">
                {p.duration_days}{" "}
                {p.duration_days === 1 ? "calendar day" : "calendar days"} ·{" "}
                {facilities(p).join(" · ")}
              </p>
              {p.code === "gym_day" && (
                <p className="text-sm text-muted-foreground">
                  Gym access for your chosen date. Any included outlet discounts
                  are shown below.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {effectiveBenefits(p, [], true, new Date(), true)
                  .filter((b) => b.percent > 0)
                  .map((b) => `${b.label} ${b.percent}% off`)
                  .join(" · ")}
              </p>
              {member.is_active && (
                <Link
                  className="inline-block rounded border bg-secondary px-4 py-3 text-sm"
                  href={`/member/upgrade?plan=${p.code}`}
                >
                  Choose dates
                </Link>
              )}
            </div>
          ))}
      </section>
      <Link
        className="inline-block py-2 text-sm underline"
        href="/member/check-ins"
      >
        Club visit history
      </Link>
    </div>
  );
}
