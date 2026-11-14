import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import {
  loadBookingCatalogue,
  loadCabanaAvailability,
} from "@/lib/bookings/server";
import {
  type Booking,
  bookingColumns,
  timeLabel,
  bookingStatus,
} from "@/lib/bookings/catalogue";
import { jamaicaTodayYmd, addDaysYmd } from "@/lib/membership/status";
import { BookingForm } from "@/components/bookings/booking-form";
import { BookingCard } from "@/components/bookings/booking-card";
import { StaffBookingActions } from "@/components/bookings/staff-booking-actions";
import { staffCreateBooking } from "./actions";
export const dynamic = "force-dynamic";
export default async function Bookings({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    err?: string;
    saved?: string;
    updated?: string;
    focus?: string;
  }>;
}) {
  const { admin } = await requireStaff(["admin", "supervisor", "front_desk"]);
  const q = await searchParams;
  const today = jamaicaTodayYmd();
  const date =
    q.date &&
    /^\d{4}-\d{2}-\d{2}$/.test(q.date) &&
    Number.isFinite(Date.parse(q.date))
      ? q.date
      : today;
  const [products, availability, rows, pending, refunds] = await Promise.all([
    loadBookingCatalogue(),
    loadCabanaAvailability(date),
    admin
      .from("experience_bookings")
      .select(bookingColumns)
      .eq("booking_date", date)
      .order("start_minute")
      .order("cabana"),
    admin
      .from("experience_bookings")
      .select("id,guest_name,booking_date,product_code")
      .eq("status", "requested")
      .order("booking_date")
      .limit(100),
    admin
      .from("experience_bookings")
      .select("id,guest_name,booking_date")
      .in("status", ["cancelled", "declined"])
      .not("paid_at", "is", null)
      .is("refunded_at", null)
      .order("booking_date")
      .limit(100),
  ]);
  if (rows.error || pending.error || refunds.error)
    throw new Error("Bookings could not be loaded");
  const bookings = (rows.data || []) as Booking[];
  return (
    <div className="space-y-6">
      <header>
        <p className="club-eyebrow">Front desk scheduling</p>
        <h1 className="mt-2 text-2xl font-semibold">
          Cabanas & Starlight Dinner
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Guest requests and walk-ins in one place. Pending cabana requests hold
          inventory until confirmed or cancelled.
        </p>
      </header>
      {q.err && (
        <p role="alert" className="oura-alert-warning">
          {q.err}
        </p>
      )}
      {(q.saved || q.updated) && (
        <p role="status" className="rounded-xl bg-muted p-4 text-sm">
          {q.saved
            ? "Booking held. Record payment received, then confirm the booking."
            : "Booking updated."}
        </p>
      )}
      <details
        className="rounded-2xl border bg-white p-4"
        open={!!pending.data?.length || !!refunds.data?.length}
      >
        <summary className="cursor-pointer font-semibold">
          Needs attention · {pending.data?.length || 0} requests ·{" "}
          {refunds.data?.length || 0} refunds to review
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <section>
            <h2 className="font-medium">Awaiting confirmation</h2>
            {pending.data?.length ? (
              pending.data.map((b) => (
                <Link
                  className="mt-2 block rounded-lg border p-3 text-sm"
                  key={b.id}
                  href={`/bookings?date=${b.booking_date}#booking-${b.id}`}
                >
                  {b.guest_name} · {b.booking_date} ·{" "}
                  {b.product_code === "starlight" ? "Dinner" : "Cabana"}
                </Link>
              ))
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                All caught up.
              </p>
            )}
          </section>
          <section>
            <h2 className="font-medium">Refund review</h2>
            {refunds.data?.length ? (
              refunds.data.map((b) => (
                <Link
                  className="mt-2 block rounded-lg border p-3 text-sm"
                  key={b.id}
                  href={`/bookings?date=${b.booking_date}#booking-${b.id}`}
                >
                  {b.guest_name} · {b.booking_date}
                </Link>
              ))
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                No refunds awaiting a record.
              </p>
            )}
          </section>
        </div>
      </details>
      <form className="flex flex-wrap items-end gap-3" action="/bookings">
        <label className="space-y-2">
          <span className="block text-sm font-medium">Schedule date</span>
          <input
            className="oura-input w-full p-3"
            name="date"
            type="date"
            defaultValue={date}
            required
          />
        </label>
        <button className="club-button-secondary">View day</button>
        <Link
          href={`/bookings?date=${addDaysYmd(date, -1)}`}
          className="club-text-link py-3"
        >
          Previous day
        </Link>
        <Link
          href={`/bookings?date=${addDaysYmd(date, 1)}`}
          className="club-text-link py-3"
        >
          Next day
        </Link>
      </form>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cabana schedule · 7 am–6 pm</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((n) => {
            const day = availability.days.find((d) => d.cabana === n);
            return (
              <article key={n} className="rounded-xl border bg-white p-4">
                <h3 className="font-semibold">Cabana {n}</h3>
                {day ? (
                  [day.first_start, day.first_start + 240].map((start) => {
                    const b = bookings.find(
                      (b) =>
                        b.cabana === n &&
                        b.start_minute === start &&
                        ["requested", "confirmed", "completed"].includes(
                          b.status,
                        ),
                    );
                    return (
                      <div
                        key={start}
                        className="mt-3 rounded-lg bg-muted/50 p-3 text-sm"
                      >
                        <p>
                          {timeLabel(start)} – {timeLabel(start + 240)}
                        </p>
                        {b ? (
                          <Link
                            className="mt-1 block font-medium underline"
                            href={`#booking-${b.id}`}
                          >
                            {b.guest_name} · {bookingStatus(b.status)}
                          </Link>
                        ) : (
                          <p className="mt-1 text-muted-foreground">
                            Available
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No bookings yet. First booking sets the day’s two slots.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <details className="rounded-2xl border bg-white p-5" open={!!q.err}>
        <summary className="cursor-pointer text-lg font-semibold">
          New front-desk booking
        </summary>
        <p className="my-4 text-sm text-muted-foreground">
          Book a walk-in or phone enquiry without creating an account. Dinner
          bookings require 24 hours’ notice. Confirm table setup and kitchen
          availability before accepting a dinner.
        </p>
        {date >= today && date <= addDaysYmd(today, 365) ? (
          <BookingForm
            products={products}
            date={date}
            {...availability}
            staff
            submissionKey={randomUUID()}
            action={staffCreateBooking}
            now={Date.now()}
          />
        ) : (
          <p>Choose a date within the next year to create a booking.</p>
        )}
      </details>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Day’s bookings</h2>
        <p className="text-xs text-muted-foreground">
          Dinner seating times are requests, subject to staff checking capacity.
          Payment records here are separate from membership payments.
        </p>
        {bookings.length ? (
          bookings.map((b) => (
            <BookingCard key={b.id} booking={b} staff>
              <StaffBookingActions booking={b} date={date} />
            </BookingCard>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No bookings on this date.
          </p>
        )}
      </section>
    </div>
  );
}
