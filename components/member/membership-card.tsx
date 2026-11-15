import { formatMemberNumber } from "@/lib/access/rules";
import { membershipDate } from "@/lib/format/date";

type Props = {
  membershipNumber?: string | number | null;
  name: string;
  product?: string;
  validThrough?: string;
  active: boolean;
  planCode?: string;
  localRewards?: boolean;
};
export function cardFinish(
  planCode: string | undefined,
  localRewards = false,
  active = true,
) {
  if (!active) return "pearl";
  if (planCode === "club_monthly_95") return "monthly";
  if (planCode === "club_weekly") return "weekly";
  if (planCode === "club_day") return "day";
  if (planCode === "gym_day") return "gym";
  return localRewards ? "local" : "pearl";
}
export function MembershipCard({
  membershipNumber,
  name,
  product,
  validThrough,
  active,
  planCode,
  localRewards = false,
}: Props) {
  const number = formatMemberNumber(membershipNumber);
  return (
    <section
      className={`club-membership-card club-card-finish club-card-finish-${cardFinish(planCode, localRewards, active)}`}
      aria-label="Digital membership card"
    >
      <svg
        className="club-card-engraving"
        viewBox="0 0 400 300"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {[76, 90, 104, 118, 132, 146, 160].map((r) => (
          <circle key={r} cx="295" cy="80" r={r} />
        ))}
        {[157, 173, 189, 205, 221, 237, 253, 269].map((y) => (
          <path
            key={y}
            d={`M 0 ${y} C 100 ${y - 42}, 220 ${y + 42}, 400 ${y - 12}`}
          />
        ))}
      </svg>
      <div className="club-card-topline">
        <div className="club-card-identity">
          <span className="club-card-monogram" aria-hidden="true">
            TC
          </span>
          <span className="club-card-brand">
            Travellers Club
            <span className="club-card-resort">Negril · Jamaica</span>
          </span>
        </div>
        <span className="club-card-product">
          {active ? product || "Free account" : "Verification required"}
        </span>
      </div>
      <div className="club-card-holder space-y-2">
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
                : "Your free Club account stays with you"
              : "Please speak with the front desk"}
          </p>
        </div>
        <span className="club-card-seal" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" />
            <circle cx="20" cy="16" r="5" />
            <path d="M8 23h24M10 27c7-4 13 4 20 0M13 31c5-3 9 3 14 0" />
          </svg>
        </span>
      </div>
    </section>
  );
}
