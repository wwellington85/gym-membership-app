import { formatMemberNumber } from "@/lib/access/rules";
import { membershipDate } from "@/lib/format/date";

type Props = {
  membershipNumber?: string | number | null;
  name: string;
  product?: string;
  validThrough?: string;
  active: boolean;
};
export function MembershipCard({
  membershipNumber,
  name,
  product,
  validThrough,
  active,
}: Props) {
  const number = formatMemberNumber(membershipNumber);
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
        {number ? (
          <p className="club-card-digits" aria-label="Membership number">
            {number}
          </p>
        ) : (
          <p className="club-card-number">
            Membership number temporarily unavailable
          </p>
        )}
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
      </div>
    </section>
  );
}
