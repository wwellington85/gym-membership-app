import Link from "next/link";
export function VisitPoints({
  points,
  active = true,
}: {
  points: number | null;
  active?: boolean;
}) {
  return (
    <section
      id="visit-points"
      className="oura-card space-y-3 p-4"
      aria-label="Visit points"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Every visit counts.</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Club visit points
          </p>
        </div>
        <div className="text-right">
          <strong className="text-2xl tabular-nums">{points ?? "—"}</strong>
          <p className="text-xs text-muted-foreground">points earned</p>
        </div>
      </div>
      {points === null && (
        <p role="status" className="text-sm">
          Your points are temporarily unavailable. Please try again.
        </p>
      )}
      <p className="text-sm">
        {active
          ? "Earn 3 points for a verified visit, once per day. Show your card to staff at the front gate or restaurant."
          : "Your recorded visit points stay on your account. Please contact the front desk to resume earning."}
      </p>
      <p className="text-sm text-muted-foreground">
        {active
          ? "Rewards are on the way. Keep collecting points for future treats; redemption is not available yet."
          : "Your earned points remain on your account. Rewards redemption is not available yet."}
      </p>
      <div className="flex flex-wrap gap-4">
        {active && (
          <Link href="/member/card" className="club-text-link">
            Show my card
          </Link>
        )}
        <Link href="/member/check-ins" className="club-text-link">
          Visit history
        </Link>
      </div>
    </section>
  );
}
