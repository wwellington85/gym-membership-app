import Link from "next/link";
import { requireMember, loadAccess, loadCatalogue } from "@/lib/access/server";
import { firstName } from "@/lib/format/name";
import { facilities } from "@/lib/access/rules";

export const dynamic = "force-dynamic";
export default async function MemberHome() {
  const { member } = await requireMember();
  const [access, catalogue] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(),
  ]);
  const free = catalogue.find((p) => p.code === "rewards_free");
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
      <section className="oura-card space-y-3 p-4">
        <h2 className="font-semibold">Your Rewards benefits</h2>
        {free && (
          <p className="text-sm">
            Restaurant & bar {Math.round(Number(free.discount_food ?? 0) * 100)}
            % · Spa {Math.round(Number(free.discount_spa ?? 0) * 100)}% · Gift
            shop {Math.round(Number(free.discount_giftshop ?? 0) * 100)}% ·
            Watersports{" "}
            {Math.round(Number(free.discount_watersports ?? 0) * 100)}%
          </p>
        )}
        <p className="text-sm opacity-80">
          Show your card before the bill is prepared. View your eligible
          discounts and published perks.
        </p>
        <Link
          href="/member/benefits"
          className="inline-block rounded border px-3 py-3 text-sm"
        >
          View my benefits
        </Link>
      </section>
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
