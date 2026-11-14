import {
  type Booking,
  money,
  timeLabel,
  dinnerMenu,
} from "@/lib/bookings/catalogue";
import { staffManageBooking } from "@/app/(staff)/bookings/actions";
export function StaffBookingActions({
  booking: b,
  date,
}: {
  booking: Booking;
  date: string;
}) {
  const hidden = (
    <>
      <input type="hidden" name="booking_id" value={b.id} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="expected_revision" value={b.revision} />
    </>
  );
  const open = ["requested", "confirmed"].includes(b.status);
  return (
    <div className="space-y-3 border-t pt-3">
      {open && !b.paid_at && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Record payment received · {money(b.total)}
          </summary>
          <form action={staffManageBooking} className="mt-3 space-y-3">
            {hidden}
            <input type="hidden" name="action" value="pay" />
            <input type="hidden" name="amount" value={b.total} />
            <input type="hidden" name="currency" value={b.currency} />
            <label className="block text-sm">
              Payment method
              <select
                className="oura-input mt-1 w-full p-3"
                name="method"
                required
              >
                <option value="cash">Cash</option>
                <option value="card">Card terminal</option>
                <option value="room_charge">Room charge</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
            <label className="block text-sm">
              Receipt / transaction reference
              <input
                className="oura-input mt-1 w-full p-3"
                name="reference"
                maxLength={200}
                required
              />
            </label>
            <p className="text-xs text-muted-foreground">
              Record only after payment has been received or posted to the
              guest’s room. This does not charge a card.
            </p>
            <button className="club-button-secondary">
              Record {money(b.total)} received
            </button>
          </form>
        </details>
      )}
      {b.status === "requested" && b.paid_at && (
        <form action={staffManageBooking} className="space-y-3">
          {hidden}
          <input type="hidden" name="action" value="confirm" />
          {b.product_code === "starlight" && (
            <label className="flex items-start gap-3 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                name="availability_checked"
                required
              />
              I have checked table setup, kitchen availability, menu choices and
              dietary notes.
            </label>
          )}
          <button className="club-button">Confirm booking</button>
        </form>
      )}
      {b.status === "confirmed" && (
        <form action={staffManageBooking}>
          {hidden}
          <input type="hidden" name="action" value="complete" />
          <button className="club-button-secondary">Mark completed</button>
        </form>
      )}
      {open && (
        <details>
          <summary className="cursor-pointer text-sm">
            Reschedule booking
          </summary>
          <form action={staffManageBooking} className="mt-3 space-y-3">
            {hidden}
            <input type="hidden" name="action" value="reschedule" />
            <label className="block text-sm">
              New date
              <input
                type="date"
                name="new_date"
                defaultValue={b.booking_date}
                required
                className="oura-input mt-1 w-full p-3"
              />
            </label>
            {b.cabana && (
              <label className="block text-sm">
                Cabana
                <select
                  name="cabana"
                  defaultValue={b.cabana}
                  className="oura-input mt-1 w-full p-3"
                >
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      Cabana {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="block text-sm">
              New start time
              <select
                name="start"
                defaultValue={b.start_minute}
                className="oura-input mt-1 w-full p-3"
              >
                {(b.cabana
                  ? Array.from({ length: 15 }, (_, i) => 420 + i * 30).filter(
                      (n) => n <= 600 || n >= 660,
                    )
                  : [1080, 1200]
                ).map((n) => (
                  <option key={n} value={n}>
                    {timeLabel(n)}
                  </option>
                ))}
              </select>
            </label>
            {!b.cabana && b.status === "confirmed" && (
              <label className="flex gap-2 text-sm">
                <input type="checkbox" name="availability_checked" required />
                New dinner arrangements checked with kitchen and service team
              </label>
            )}
            <p className="text-xs text-muted-foreground">
              Check the day’s schedule first. A conflicting move is rejected
              without changing the original booking. Existing price and payment
              records stay with this booking.
            </p>
            <button className="club-button-secondary">Save new slot</button>
          </form>
        </details>
      )}
      {open && b.product_code === "starlight" && (
        <details>
          <summary className="cursor-pointer text-sm">
            Update dinner menu
          </summary>
          <form action={staffManageBooking} className="mt-3 space-y-3">
            {hidden}
            <input type="hidden" name="action" value="menu" />
            {b.menu.map((person, i) => (
              <fieldset className="space-y-2 rounded-xl border p-3" key={i}>
                <legend className="text-sm font-medium">Guest {i + 1}</legend>
                {Object.entries(dinnerMenu)
                  .filter(([key]) => key !== "sides")
                  .map(([key, options]) => (
                    <label key={key} className="block text-sm capitalize">
                      {key}
                      <select
                        name={`${key}_${i}`}
                        defaultValue={
                          person[
                            key as "appetizer" | "salad" | "main" | "dessert"
                          ]
                        }
                        className="oura-input mt-1 w-full p-3"
                        required
                      >
                        {options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                <p className="text-sm">Choose two sides</p>
                {dinnerMenu.sides.map((s) => (
                  <label key={s} className="flex gap-2 py-2 text-sm">
                    <input
                      type="checkbox"
                      name={`sides_${i}`}
                      value={s}
                      defaultChecked={person.sides.includes(s)}
                    />
                    {s}
                  </label>
                ))}
              </fieldset>
            ))}
            <label className="block text-sm">
              Dietary notes
              <textarea
                name="dietary_notes"
                defaultValue={b.dietary_notes}
                maxLength={2000}
                className="oura-input mt-1 w-full p-3"
              />
            </label>
            <button className="club-button-secondary">Save menu</button>
          </form>
        </details>
      )}
      {open && (
        <details>
          <summary className="cursor-pointer text-sm">
            Cancel / release booking
          </summary>
          <form action={staffManageBooking} className="mt-3 space-y-3">
            {hidden}
            <input type="hidden" name="action" value="cancel" />
            <label className="block text-sm">
              Reason{" "}
              <span className="text-muted-foreground">(visible to guest)</span>
              <input
                className="oura-input mt-1 w-full p-3"
                name="reason"
                minLength={3}
                maxLength={1000}
                required
              />
            </label>
            {b.paid_at && (
              <p className="text-xs">
                Cancellation releases the slot. Any refund must be processed
                separately, then recorded here.
              </p>
            )}
            <button className="club-button-secondary">
              Cancel and release
            </button>
          </form>
        </details>
      )}
      {["cancelled", "declined"].includes(b.status) &&
        b.paid_at &&
        !b.refunded_at && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              Record refund paid · {money(b.total)}
            </summary>
            <form action={staffManageBooking} className="mt-3 space-y-3">
              {hidden}
              <input type="hidden" name="action" value="refund" />
              <label className="block text-sm">
                Refund receipt reference
                <input
                  className="oura-input mt-1 w-full p-3"
                  name="reference"
                  maxLength={200}
                  required
                />
              </label>
              <label className="block text-sm">
                Reason
                <input
                  className="oura-input mt-1 w-full p-3"
                  name="reason"
                  minLength={3}
                  maxLength={1000}
                  required
                />
              </label>
              <p className="text-xs">
                Record only after the full refund has been paid. This does not
                transfer money.
              </p>
              <button className="club-button-secondary">
                Record full refund paid
              </button>
            </form>
          </details>
        )}
    </div>
  );
}
