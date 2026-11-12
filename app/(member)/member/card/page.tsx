import Link from "next/link";
import { requireMember, loadAccess } from "@/lib/access/server";
import { memberNumber, facilities } from "@/lib/access/rules";
import { RotatingQr } from "./RotatingQr";

export const dynamic = "force-dynamic";
export default async function MemberCard() {
  const { member } = await requireMember();
  const access = await loadAccess(member.id, member.is_active);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">My membership card</h1>
      <div className="oura-card space-y-3 p-4">
        <p className="text-sm uppercase tracking-widest">Travellers Rewards</p>
        <h2 className="text-xl font-semibold">{member.full_name}</h2>
        <p className="text-sm">
          {member.is_active
            ? "Rewards member · Active"
            : "Membership needs front desk assistance"}
        </p>
        <p
          className="break-all font-mono text-xs"
          aria-label="Membership number"
        >
          {memberNumber(member.id)}
        </p>
        {member.is_active && <RotatingQr />}
        <p className="text-sm opacity-80">
          Show this card to staff to verify your benefits. If the QR cannot
          load, staff can look up your membership number or name.
        </p>
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold">Facility access now</h2>
        {access.current.length ? (
          access.current.map((p) => (
            <div key={p.id} className="rounded border p-3 text-sm">
              <p className="font-medium">{p.plan_snapshot.name}</p>
              <p className="mt-2">{facilities(p.plan_snapshot).join(" · ")}</p>
              <p className="mt-2 opacity-80">
                Valid through {p.paid_through_date}, until 10 pm Jamaica time.
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm opacity-80">
            No paid facility access is valid now. Your Rewards membership is
            separate from gym/resort passes. In-house guests should ask the
            front desk about access included in their booking.
          </p>
        )}
      </section>
      <Link
        href="/member/access"
        className="inline-block rounded border px-3 py-3 text-sm"
      >
        View passes and dates
      </Link>
    </div>
  );
}
