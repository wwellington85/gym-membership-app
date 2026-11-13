import Link from "next/link";
import { requireMember, loadAccess } from "@/lib/access/server";
import { facilities } from "@/lib/access/rules";
import { membershipDate } from "@/lib/format/date";
import { MembershipCard } from "@/components/member/membership-card";
import { RotatingQr } from "./RotatingQr";

export const dynamic = "force-dynamic";
export default async function MemberCard() {
  const { member } = await requireMember();
  const access = await loadAccess(member.id, member.is_active);
  return (
    <div className="space-y-6">
      <header>
        <h1>Your membership.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ready for your next visit.
        </p>
      </header>
      <MembershipCard
        membershipNumber={member.member_number}
        name={member.full_name}
        active={member.is_active}
        product={access.best?.plan_snapshot.name}
        validThrough={access.best?.paid_through_date}
      />
      {member.is_active ? (
        <section className="club-qr-panel text-center">
          <h2 className="font-semibold">Show your live QR to staff</h2>
          <RotatingQr />
          <p className="text-xs text-muted-foreground">
            If your QR cannot load, staff can look up the membership number on
            your card.
          </p>
        </section>
      ) : (
        <p role="alert" className="oura-alert-warning">
          Your membership needs front desk assistance before benefits or access
          can be used.
        </p>
      )}
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Access included now</h2>
          {access.current.length > 0 && (
            <span className="club-status">Active</span>
          )}
        </div>
        {access.current.length ? (
          access.current.map((pass) => (
            <div key={pass.id} className="border-b py-4">
              <h3 className="font-medium">{pass.plan_snapshot.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {facilities(pass.plan_snapshot).join(" · ")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Until {membershipDate(pass.paid_through_date)} · 10 pm Jamaica
                time
              </p>
            </div>
          ))
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No facility pass is active now. Your Rewards membership is separate.
            Staying at the hotel? Ask the front desk about access included in
            your booking.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/member/access" className="club-button-secondary">
            Manage access
          </Link>
          <Link href="/member/benefits" className="club-text-link">
            View your benefits
          </Link>
        </div>
      </section>
    </div>
  );
}
