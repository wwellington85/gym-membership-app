"use client";
import { useState, useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  cabanaStarts,
  availableCabanaStarts,
  dinnerMenu,
  futureSlot,
  money,
  productTotal,
  timeLabel,
  type ExperienceProduct,
  type CabanaDay,
  type OccupiedSlot,
} from "@/lib/bookings/catalogue";

function Submit({ staff }: { staff: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="club-button" disabled={pending}>
      {pending
        ? "Saving…"
        : staff
          ? "Hold booking for payment"
          : "Request booking"}
    </button>
  );
}
export function BookingForm({
  products,
  date,
  days,
  occupied,
  submissionKey,
  staff = false,
  action,
  now,
}: {
  products: ExperienceProduct[];
  date: string;
  days: CabanaDay[];
  occupied: OccupiedSlot[];
  submissionKey: string;
  staff?: boolean;
  action: (form: FormData) => Promise<{ error: string } | void>;
  now: number;
}) {
  const [result, submitAction] = useActionState(
    async (
      _previous: { error: string; values: Record<string, string[]> },
      form: FormData,
    ) => {
      const values: Record<string, string[]> = {};
      for (const key of new Set(form.keys()))
        values[key] = form.getAll(key).map(String);
      return { ...((await action(form)) || { error: "" }), values };
    },
    { error: "", values: {} as Record<string, string[]> },
  );
  const previousValue = (name: string) => result.values[name]?.[0] || "";
  const [product, setProduct] = useState(products[0]?.code || "");
  const p = products.find((p) => p.code === product);
  const dinner = product === "starlight";
  const [cabana, setCabana] = useState(1);
  const [menuError, setMenuError] = useState("");
  const starts = (
    dinner
      ? [1080, 1200]
      : staff
        ? cabanaStarts(cabana, days, occupied)
        : availableCabanaStarts(days, occupied)
  ).filter((n) => futureSlot(date, n, dinner ? 24 : 0, now));
  if (!p)
    return <p>No packages are available. Please contact the front desk.</p>;
  return (
    <form
      action={submitAction}
      onSubmit={(e) => {
        if (dinner) {
          const data = new FormData(e.currentTarget);
          if ([0, 1].some((i) => data.getAll(`sides_${i}`).length !== 2)) {
            e.preventDefault();
            setMenuError("Please choose exactly two sides for each guest.");
            return;
          }
        }
        setMenuError("");
      }}
      className="space-y-5 rounded-2xl border bg-white p-5"
    >
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="submission_key" value={submissionKey} />
      <label className="block space-y-2">
        <span className="font-medium">Package</span>
        <select
          name="product"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          className="oura-input w-full p-3"
        >
          {products.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name} · {money(productTotal(p))}
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-xl bg-muted/50 p-4 text-sm">
        <p className="font-semibold">
          {money(productTotal(p))}
          {dinner ? " for two" : " · four hours"}
        </p>
        {dinner && (
          <p className="mt-1 text-muted-foreground">
            {money(p.price)} + 10% tax + 10% service charge
          </p>
        )}
        <ul className="mt-2 space-y-1">
          {p.inclusions.map((i) => (
            <li key={i}>✓ {i}</li>
          ))}
        </ul>
      </div>
      {staff && (
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-3 font-semibold">Guest details</legend>
          <label className="block sm:col-span-2">
            Club membership number (optional)
            <input
              className="oura-input mt-1 w-full p-3"
              name="member_number"
              defaultValue={previousValue("member_number")}
              inputMode="numeric"
              maxLength={24}
            />
            <span className="text-xs text-muted-foreground">
              Link this booking to the member’s app account.
            </span>
          </label>
          <label className="block">
            Full name
            <input
              className="oura-input mt-1 w-full p-3"
              name="guest_name"
              defaultValue={previousValue("guest_name")}
              maxLength={120}
              required
            />
          </label>
          <label className="block">
            Phone
            <input
              className="oura-input mt-1 w-full p-3"
              name="phone"
              defaultValue={previousValue("phone")}
              type="tel"
              maxLength={40}
            />
          </label>
          <label className="block">
            Email
            <input
              className="oura-input mt-1 w-full p-3"
              name="email"
              defaultValue={previousValue("email")}
              type="email"
              maxLength={254}
            />
          </label>
          <label className="block">
            Room number
            <input
              className="oura-input mt-1 w-full p-3"
              name="room"
              defaultValue={previousValue("room")}
              maxLength={40}
            />
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Add a phone, email or room number. Walk-in guests do not need a Club
            account.
          </p>
        </fieldset>
      )}
      {!dinner && staff && (
        <label className="block space-y-2">
          <span className="font-medium">Cabana</span>
          <select
            name="cabana"
            value={cabana}
            onChange={(e) => setCabana(Number(e.target.value))}
            className="oura-input w-full p-3"
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                Cabana {n}
              </option>
            ))}
          </select>
        </label>
      )}
      <label id="booking-times" className="block scroll-mt-24 space-y-2">
        <span className="font-medium">
          {dinner ? "Preferred dinner time" : "Available time slot"}
        </span>
        <select
          key={`${product}:${cabana}:${date}`}
          name="start"
          className="oura-input w-full p-3"
          required
          defaultValue={previousValue("start")}
        >
          <option value="" disabled>
            Choose a time
          </option>
          {starts.map((n) => (
            <option key={n} value={n}>
              {timeLabel(n)}
              {dinner ? "" : ` – ${timeLabel(n + 240)}`}
            </option>
          ))}
        </select>
      </label>
      {starts.length === 0 && (
        <p role="status" className="text-sm">
          {dinner
            ? "Dinner needs at least 24 hours’ notice. Choose a later date."
            : staff
              ? "No available slots for this cabana. Try another cabana or date."
              : "No cabanas are available for this date. Please choose another day."}
        </p>
      )}
      {!dinner && (
        <p className="text-xs text-muted-foreground">
          {staff
            ? "Open 7 am–6 pm. The first booking sets two consecutive four-hour slots for that cabana and date. Pending requests hold their slots."
            : "Choose a four-hour time slot between 7 am and 6 pm. We’ll arrange your cabana for you."}
        </p>
      )}
      {dinner && (
        <>
          <label className="block">
            Occasion
            <select
              className="oura-input mt-1 w-full p-3"
              name="occasion"
              defaultValue={previousValue("occasion")}
            >
              <option value="">Just because</option>
              {["Birthday", "Anniversary", "Date", "Other"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <p className="text-sm text-muted-foreground">
            Choose a menu for each guest. Seasonal items and beach setup are
            subject to staff confirmation.
          </p>
          {[0, 1].map((i) => (
            <details key={i} open className="rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold">
                Guest {i + 1} · menu choices
              </summary>
              <div className="mt-4 space-y-4">
                {Object.entries(dinnerMenu)
                  .filter(([k]) => k !== "sides")
                  .map(([k, options]) => (
                    <label className="block capitalize" key={k}>
                      {k}
                      <select
                        className="oura-input mt-1 w-full p-3"
                        name={`${k}_${i}`}
                        required
                        defaultValue={previousValue(`${k}_${i}`)}
                      >
                        <option value="" disabled>
                          Choose {k}
                        </option>
                        {options.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                <fieldset>
                  <legend className="mb-2 font-medium">
                    Sides · choose two
                  </legend>
                  {dinnerMenu.sides.map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name={`sides_${i}`}
                        value={s}
                        defaultChecked={
                          result.values[`sides_${i}`]?.includes(s) || false
                        }
                        className="h-4 w-4"
                      />
                      {s}
                    </label>
                  ))}
                </fieldset>
              </div>
            </details>
          ))}
          <label className="block">
            Allergies or dietary restrictions
            <textarea
              name="dietary_notes"
              defaultValue={previousValue("dietary_notes")}
              className="oura-input mt-1 w-full p-3"
              maxLength={2000}
              rows={3}
            />
          </label>
        </>
      )}
      <label className="block">
        Anything else we should know?{" "}
        <span className="text-muted-foreground">(optional)</span>
        <textarea
          name="notes"
          defaultValue={previousValue("notes")}
          className="oura-input mt-1 w-full p-3"
          rows={2}
          maxLength={2000}
        />
      </label>
      {menuError && (
        <p role="alert" className="text-sm text-red-700">
          {menuError}
        </p>
      )}
      {result.error && (
        <p role="alert" className="oura-alert-warning">
          {result.error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Pay at the front desk. Your booking is confirmed after staff record
        payment and confirm the arrangements.
      </p>
      <Submit staff={staff} />
    </form>
  );
}
