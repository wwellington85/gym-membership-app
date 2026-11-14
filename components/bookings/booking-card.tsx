import {
  bookingStatus,
  money,
  timeLabel,
  type Booking,
} from "@/lib/bookings/catalogue";
import { membershipDate } from "@/lib/format/date";
export function BookingCard({
  booking: b,
  staff = false,
  children,
}: {
  booking: Booking;
  staff?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <article
      className="space-y-3 rounded-2xl border bg-white p-5"
      id={`booking-${b.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{b.product_snapshot.name}</h2>
          <p className="mt-1 text-sm">
            {membershipDate(b.booking_date)} · {timeLabel(b.start_minute)}
            {b.cabana
              ? ` – ${timeLabel(b.end_minute ?? b.start_minute + 240)}${staff ? ` · Cabana ${b.cabana}` : ""}`
              : ""}
          </p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
          {bookingStatus(b.status)}
        </span>
      </div>
      <p className="text-sm">
        {money(b.total, b.currency)} ·{" "}
        {b.refunded_at
          ? "Refund recorded"
          : b.paid_at
            ? b.status === "cancelled" || b.status === "declined"
              ? "Paid · refund review needed"
              : "Paid at front desk"
            : "Payment due at front desk"}
      </p>
      <p className="text-xs text-muted-foreground">
        Reference {b.id.slice(0, 8).toUpperCase()}
      </p>
      {staff && (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{b.guest_name}</p>
          <p className="break-words">
            {[b.email, b.phone, b.room ? `Room ${b.room}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {b.payment_reference && (
            <p>
              Receipt: {b.payment_reference} ·{" "}
              {b.payment_method?.replace("_", " ")}
            </p>
          )}
          {b.refund_reference && <p>Refund receipt: {b.refund_reference}</p>}
        </div>
      )}
      {b.occasion && <p className="text-sm">Occasion: {b.occasion}</p>}
      {b.menu?.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">
            Menu for two
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {b.menu.map((p, i) => (
              <div key={i} className="text-sm">
                <h3 className="font-semibold">Guest {i + 1}</h3>
                <ul className="mt-1 space-y-1">
                  {[p.appetizer, p.salad, p.main, ...p.sides, p.dessert].map(
                    (v, j) => (
                      <li key={j}>{v}</li>
                    ),
                  )}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
      {b.dietary_notes && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm">
          <strong>Dietary notes:</strong> {b.dietary_notes}
        </p>
      )}
      {b.notes && <p className="whitespace-pre-wrap text-sm">{b.notes}</p>}
      {b.cancellation_reason && (
        <p className="text-sm text-muted-foreground">{b.cancellation_reason}</p>
      )}
      {children}
    </article>
  );
}
