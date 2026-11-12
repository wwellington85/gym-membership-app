import Link from "next/link";
import { loadCatalogue, loadAccess, requireMember } from "@/lib/access/server";
import { facilities, passIsActive } from "@/lib/access/rules";
import { addDaysYmd, jamaicaTodayYmd } from "@/lib/membership/status";

export const dynamic = "force-dynamic";
export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const { member } = await requireMember();
  const [catalogue, access, sp] = await Promise.all([
    loadCatalogue(),
    loadAccess(member.id, member.is_active),
    searchParams,
  ]);
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Gym & resort access</h1>
      <p className="text-sm opacity-80">
        Optional passes alongside your free Rewards membership. Staying at the
        hotel? Ask the front desk what your room booking includes before buying.
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
          <p className="text-sm opacity-80">
            No passes yet. Your free Rewards benefits remain available.
          </p>
        )}
        {access.passes.map((p) => (
          <div key={p.id} className="oura-card space-y-2 p-4">
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
            <p className="text-sm opacity-80">
              {facilities(p.plan_snapshot).join(" · ")} · Ends at 10 pm Jamaica
              time.
            </p>
            {member.is_active &&
              passIsActive(p) &&
              p.paid_through_date <= addDaysYmd(jamaicaTodayYmd(), 3) && (
                <p className="text-sm font-medium">
                  This pass ends soon. Your free Rewards membership will
                  continue.
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
        <h2 className="font-semibold">Explore passes</h2>
        {catalogue
          .filter(
            (p) => p.grants_access && p.price > 0 && p.duration_days < 3650,
          )
          .map((p) => (
            <div key={p.id} className="oura-card space-y-3 p-4">
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
                <p className="text-sm opacity-80">
                  Gym only; other resort facilities are not included. Standard
                  Rewards discounts continue.
                </p>
              )}
              <div className="text-sm opacity-80">
                Restaurant & bar{" "}
                {Math.round(Number(p.discount_food ?? 0) * 100)}% · Spa{" "}
                {Math.round(Number(p.discount_spa ?? 0) * 100)}% · Gift shop{" "}
                {Math.round(Number(p.discount_giftshop ?? 0) * 100)}% ·
                Watersports{" "}
                {Math.round(Number(p.discount_watersports ?? 0) * 100)}%
              </div>
              {member.is_active && (
                <Link
                  className="inline-block rounded border bg-indigo-500/20 px-4 py-3 text-sm"
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
        Gym visit history
      </Link>
    </div>
  );
}
