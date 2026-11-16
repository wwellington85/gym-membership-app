"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BookingForm } from "./booking-form";
import { requestableTimes } from "@/lib/bookings/catalogue";
import { membershipDate } from "@/lib/format/date";

export function MemberBooking({
  today,
  maxDate,
  dinner,
  autoSelected = false,
  noDates = false,
  ...booking
}: React.ComponentProps<typeof BookingForm> & {
  today: string;
  maxDate: string;
  dinner: boolean;
  autoSelected?: boolean;
  noDates?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedDate, setSelectedDate] = useState(booking.date);
  const times = requestableTimes(
    booking.date,
    dinner,
    booking.days,
    booking.occupied,
    booking.now,
  );
  const hasTimes = !noDates && times.length > 0;
  function navigate(query: string) {
    startTransition(() =>
      router.replace(
        `/member/experiences?kind=${dinner ? "dinner" : "cabana"}&${query}`,
        { scroll: false },
      ),
    );
  }
  return (
    <div className="space-y-4" aria-busy={pending}>
      <div className="min-w-0 space-y-2">
        <label htmlFor="experience-date" className="block text-sm font-medium">
          1. Choose a date
        </label>
        <input
          id="experience-date"
          type="date"
          value={selectedDate}
          min={today}
          max={maxDate}
          required
          disabled={pending}
          className="oura-input block min-w-0 w-full max-w-full box-border p-3"
          onChange={(e) => {
            const value = e.currentTarget.value;
            setSelectedDate(value);
            if (value && e.currentTarget.validity.valid)
              navigate(`date=${encodeURIComponent(value)}`);
          }}
        />
        {autoSelected &&
          hasTimes &&
          selectedDate === booking.date &&
          !pending && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {dinner
                ? "The next date you can request is selected, allowing 24 hours’ notice."
                : "The next date with an available cabana is selected."}{" "}
              You can change the date.
            </p>
          )}
      </div>
      {pending ? (
        <p role="status" className="rounded-xl bg-muted/50 p-4 text-sm">
          Finding times for your date…
        </p>
      ) : selectedDate !== booking.date ? (
        <p role="status" className="text-sm text-muted-foreground">
          Choose a date above to see times.
        </p>
      ) : hasTimes ? (
        <>
          <p className="text-xs text-muted-foreground">
            {dinner ? "Dinner times you can request" : "Available times"} for{" "}
            {membershipDate(booking.date)}
            {dinner ? " · Subject to staff confirmation" : ""}
          </p>
          <BookingForm key={booking.date} {...booking} />
        </>
      ) : (
        <section
          className="space-y-3 rounded-xl border bg-muted/40 p-4"
          aria-label="Choose another booking date"
        >
          <p role="status" className="text-sm">
            {noDates
              ? "No later dates with times were found. Please choose another date or contact the front desk."
              : dinner
                ? `No dinner times can be requested on ${membershipDate(booking.date)}. Please choose a later date.`
                : `No cabana times are available on ${membershipDate(booking.date)}. Please choose another date.`}
          </p>
          {booking.date < maxDate && !noDates && (
            <button
              type="button"
              className="club-button-secondary"
              onClick={() => navigate(`after=${booking.date}`)}
            >
              Find next date →
            </button>
          )}
          <a href="/member/help" className="club-text-link text-sm">
            Contact the front desk →
          </a>
        </section>
      )}
    </div>
  );
}
