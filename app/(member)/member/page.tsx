import Link from "next/link";
import { requireMember, loadAccess, loadCatalogue } from "@/lib/access/server";
import { firstName } from "@/lib/format/name";
import { facilities } from "@/lib/access/rules";
import { effectiveBenefits } from "@/lib/access/benefits";

export const dynamic = "force-dynamic";
export default async function MemberHome() {
  const { member } = await requireMember();
  const [access, catalogue] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(),
  ]);
  const free = catalogue.find((p) => p.code === "rewards_free");
  const benefits = effectiveBenefits(free, access.passes, member.is_active);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm opacity-80">Travellers Club</p>
        <h1 className="mt-2 text-2xl font-semibold">
          Welcome, {firstName(member.full_name)}
        </h1>
        <p className="mt-2 text-sm opacity-80">
          Your Rewards membership stays with you between visits.
        </p>
      </div>
      {!member.is_active && (
        <p role="alert" className="oura-alert-warning">
          Please contact the front desk about your membership. Benefits and
          access need verification.
        </p>
      )}
      <Link
        href="/member/card"
        className="block rounded-2xl border border-indigo-300/40 bg-indigo-500/20 p-5"
      >
        <span className="text-lg font-semibold">Show my card</span>
        <span className="mt-2 block text-sm">
          Use your digital membership at participating outlets.
        </span>
      </Link>
      {member.is_active && (
        <section className="oura-card space-y-3 p-4">
          <h2 className="font-semibold">Your benefits now</h2>
          <dl className="divide-y divide-white/10">
            {benefits.map((benefit) => (
              <div
                key={benefit.key}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <dt>{benefit.label}</dt>
                <dd className="shrink-0 font-semibold tabular-nums">
                  {benefit.percent}% off
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm opacity-80">
            Your highest eligible discount at each outlet, including active pass
            benefits. Discounts do not add together. Enhanced rates end when
            their pass expires.
          </p>
          <Link
            href="/member/benefits"
            className="inline-block rounded border px-3 py-3 text-sm"
          >
            View benefits & details
          </Link>
        </section>
      )}
      <section className="oura-card space-y-3 p-4">
        <h2 className="font-semibold">Gym & resort access</h2>
        {access.best ? (
          <>
            <p className="text-sm">
              {access.best.plan_snapshot.name} · Valid through{" "}
              {access.best.paid_through_date}, 10 pm Jamaica time.
            </p>
            <p className="text-sm opacity-80">
              {facilities(access.best.plan_snapshot).join(" · ")}
            </p>
          </>
        ) : (
          <p className="text-sm opacity-80">
            Optional gym-only and resort passes are available. Your Rewards
            membership does not require a paid pass.
          </p>
        )}
        <Link
          href="/member/access"
          className="inline-block rounded border px-3 py-3 text-sm"
        >
          {access.best ? "Manage or renew access" : "Explore access"}
        </Link>
      </section>
      <Link
        href="/member/gym"
        className="block rounded border px-4 py-3 text-sm"
      >
        Visit your Gym section — history, progress, and rankings
      </Link>
      <p className="text-sm opacity-80">
        Planning another visit or need help using a benefit?{" "}
        <Link href="/member/help" className="underline">
          Speak with the front desk
        </Link>
        .
      </p>
    </div>
  );
}
