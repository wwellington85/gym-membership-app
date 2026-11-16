import Link from "next/link";
import { RewardIcon } from "@/components/rewards/reward-icon";
import { membershipDate } from "@/lib/format/date";
import { timeLabel } from "@/lib/bookings/catalogue";
import type { HomeBooking, HomeReward } from "@/lib/member/home-updates";
export function HomeUpdates({
  booking,
  reward,
  error,
}: {
  booking: HomeBooking | null;
  reward: HomeReward | null;
  error: boolean;
}) {
  return (
    <>
      {booking && (
        <Link
          href={`/member/bookings#booking-${booking.id}`}
          className="club-home-update"
        >
          <span className="club-eyebrow">Your next booking</span>
          <span className="block text-sm font-medium">
            {booking.product_code === "starlight"
              ? "Starlight Dinner"
              : "Cabana rental"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {membershipDate(booking.booking_date)} ·{" "}
            {timeLabel(booking.start_minute)} →
          </span>
        </Link>
      )}
      {reward && (
        <Link
          prefetch={false}
          href={`/member/rewards/${reward.id}`}
          className="club-home-update"
        >
          <span className="flex items-center gap-3">
            <RewardIcon icon={reward.icon} />
            <span>
              <span className="club-eyebrow">A gift for you</span>
              <span className="mt-1 block text-sm font-medium">
                {reward.title}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                View your reward →
              </span>
            </span>
          </span>
        </Link>
      )}
      {error && (
        <p role="status" className="text-xs text-muted-foreground">
          Check My bookings or Benefits for your latest updates.
        </p>
      )}
    </>
  );
}
