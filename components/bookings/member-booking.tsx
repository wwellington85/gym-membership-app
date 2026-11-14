"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BookingForm } from "./booking-form";

export function MemberBooking({
  today,
  maxDate,
  dinner,
  ...booking
}: React.ComponentProps<typeof BookingForm> & {
  today: string;
  maxDate: string;
  dinner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="space-y-5" aria-busy={pending}>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="experience-date" className="text-sm font-medium">
            {dinner ? "Dinner date" : "Rental date"}
          </label>
          <a href="#booking-times" className="club-text-link text-sm">
            Show times ↓
          </a>
        </div>
        <input
          id="experience-date"
          key={booking.date}
          type="date"
          defaultValue={booking.date}
          min={today}
          max={maxDate}
          required
          disabled={pending}
          className="oura-input block min-w-0 w-full max-w-full box-border p-3"
          onChange={(e) => {
            if (!e.currentTarget.value || !e.currentTarget.validity.valid)
              return;
            const date = e.currentTarget.value;
            startTransition(() =>
              router.replace(
                `/member/experiences?kind=${dinner ? "dinner" : "cabana"}&date=${encodeURIComponent(date)}`,
                { scroll: false },
              ),
            );
          }}
        />
        {pending && (
          <p role="status" className="text-sm text-muted-foreground">
            Updating times…
          </p>
        )}
      </div>
      <fieldset
        disabled={pending}
        className="min-w-0"
        aria-label="Booking details"
      >
        <BookingForm key={booking.date} {...booking} />
      </fieldset>
    </div>
  );
}
