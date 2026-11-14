import Link from "next/link";
import { requireMember } from "@/lib/access/server";
import { type Booking, bookingColumns } from "@/lib/bookings/catalogue";
import { BookingCard } from "@/components/bookings/booking-card";
import { cancelExperience } from "../experiences/actions";
import { jamaicaTodayYmd } from "@/lib/membership/status";
export const dynamic = "force-dynamic";
export default async function MyBookings({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; cancelled?: string; err?: string }>;
}) {
  const { member, admin } = await requireMember();
  const q = await searchParams;
  const { data, error } = await admin
    .from("experience_bookings")
    .select(bookingColumns)
    .eq("member_id", member.id)
    .order("booking_date", { ascending: false })
    .order("start_minute")
    .limit(100);
  if (error) throw new Error("Bookings could not be loaded");
  const bookings = (data || []) as Booking[];
  const today = jamaicaTodayYmd();
  const upcoming = bookings
    .filter(
      (b) =>
        b.booking_date >= today &&
        ["requested", "confirmed"].includes(b.status),
    )
    .sort(
      (a, b) =>
        a.booking_date.localeCompare(b.booking_date) ||
        a.start_minute - b.start_minute,
    );
  const history = bookings.filter((b) => !upcoming.includes(b));
  const card = (b: Booking) => (
    <BookingCard key={b.id} booking={b}>
      {b.status === "requested" && !b.paid_at ? (
        <form action={cancelExperience}>
          <input type="hidden" name="booking_id" value={b.id} />
          <button className="club-text-link text-sm">Cancel request</button>
        </form>
      ) : b.status === "confirmed" ||
        (b.paid_at &&
          !["cancelled", "declined", "completed"].includes(b.status)) ? (
        <p className="text-xs text-muted-foreground">
          Contact the front desk if you need to change or cancel this booking.
        </p>
      ) : null}
    </BookingCard>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-semibold">My bookings</h1>
        <Link href="/member/experiences" className="club-text-link">
          Book an experience
        </Link>
      </div>
      {q.err && (
        <p role="alert" className="oura-alert-warning">
          {q.err}
        </p>
      )}
      {q.saved && (
        <p role="status" className="rounded-xl bg-muted p-4 text-sm">
          Request received. Please arrange payment at the front desk; staff will
          confirm your booking here.
        </p>
      )}
      {q.cancelled && <p role="status">Your request has been cancelled.</p>}
      {upcoming.length ? (
        upcoming.map(card)
      ) : (
        <p className="text-sm text-muted-foreground">
          No upcoming bookings. Make your next visit a little more special.
        </p>
      )}
      {history.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">
            Past and cancelled bookings
          </summary>
          <div className="mt-4 space-y-4">{history.map(card)}</div>
        </details>
      )}
    </div>
  );
}
