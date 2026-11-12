"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  purchasePeriod,
  type AccessPass,
  type AccessPlan,
} from "@/lib/access/rules";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded border bg-indigo-500/30 px-4 py-3 font-medium disabled:opacity-50"
    >
      {pending ? "Preparing checkout…" : "Continue to secure payment"}
    </button>
  );
}

export function AccessPurchaseForm({
  plan,
  current,
  today,
  checkoutKey,
  renew,
}: {
  plan: AccessPlan;
  current: AccessPass | null;
  today: string;
  checkoutKey: string;
  renew: boolean;
}) {
  const [start, setStart] = useState(today);
  let period: { start: string; end: string } | null = null;
  try {
    period = purchasePeriod({
      start,
      duration: plan.duration_days,
      planId: plan.id,
      renew,
      current,
    });
  } catch {
    /* native date field handles incomplete entry */
  }
  return (
    <form action="/api/fygaro/checkout" method="post" className="space-y-4">
      <input type="hidden" name="plan" value={plan.code} />
      <input type="hidden" name="checkout_key" value={checkoutKey} />
      <input type="hidden" name="quote" value={JSON.stringify(plan)} />
      <input type="hidden" name="intent" value={renew ? "renew" : "buy"} />
      <div className="space-y-2">
        <label htmlFor="access-start">
          {renew ? "Earliest renewal start" : "Start date"}
        </label>
        <input
          id="access-start"
          name="start_date"
          type="date"
          required
          min={today}
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="oura-input join-date-input block w-full p-3"
        />
      </div>
      {period && (
        <p aria-live="polite" className="rounded border p-3 text-sm">
          Valid {period.start} through {period.end}, until 10 pm Jamaica time on
          the last day.
          {renew
            ? " This extends this product after your existing pass ends."
            : " Your other passes and free Rewards membership remain unchanged."}
        </p>
      )}
      <label className="flex items-start gap-3 rounded border p-3 text-sm">
        <input
          name="waiver"
          type="checkbox"
          required
          className="mt-1 h-5 w-5 shrink-0"
        />
        <span>
          I understand the risks involved with using the facilities (including
          the gym) and release Travellers Beach Resort from liability.
        </span>
      </label>
      <p className="text-sm">
        Total: <strong>${Number(plan.price).toFixed(2)} USD</strong> · One-time
        purchase. Access activates after payment confirmation.
      </p>
      <Submit />
    </form>
  );
}
