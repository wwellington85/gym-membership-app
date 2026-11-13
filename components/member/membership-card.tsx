import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { memberNumber } from "@/lib/access/rules";
import { membershipDate } from "@/lib/format/date";

type Props = {
  memberId: string;
  name: string;
  product?: string;
  validThrough?: string;
  active: boolean;
  showCardLink?: boolean;
};
export function MembershipCard({
  memberId,
  name,
  product,
  validThrough,
  active,
  showCardLink = false,
}: Props) {
  return (
    <section
      className="club-membership-card"
      aria-label="Digital membership card"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="club-card-brand">Travellers Club</span>
        <span className="club-card-product">
          {product || "Rewards membership"}
        </span>
      </div>
      <div className="space-y-2">
        <h2 className="club-card-name">{name}</h2>
        <p className="club-card-number" aria-label="Membership number">
          {memberNumber(memberId)}
        </p>
      </div>
      <div className="club-card-footer">
        <div>
          <p className="club-eyebrow">
            {active ? "Digital membership" : "Verification required"}
          </p>
          <p className="mt-1 text-xs">
            {active
              ? validThrough
                ? `Access until ${membershipDate(validThrough)}`
                : "Your Rewards membership stays with you"
              : "Please speak with the front desk"}
          </p>
        </div>
        {showCardLink && (
          <Link href="/member/card" className="club-card-cta">
            Show card <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}
