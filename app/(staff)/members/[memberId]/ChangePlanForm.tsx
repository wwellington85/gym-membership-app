"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import {
  purchasePeriod,
  type AccessPlan,
  type AccessPass,
} from "@/lib/access/rules";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="w-full rounded border p-3 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Confirm access & record payment"}
    </button>
  );
}
export function ChangePlanForm({
  memberId,
  plans,
  passes,
  checkoutKey,
  today,
  action,
}: {
  memberId: string;
  plans: AccessPlan[];
  passes: AccessPass[];
  checkoutKey: string;
  today: string;
  action: (data: FormData) => Promise<void>;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id || "");
  const [start, setStart] = useState(today);
  const [intent, setIntent] = useState("buy");
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState(String(plans[0]?.price ?? 0));
  const selected = plans.find((p) => p.id === planId);
  const current = passes.find(
    (p) => p.plan_id === planId && p.status === "active",
  );
  let period;
  try {
    if (selected)
      period = purchasePeriod({
        start,
        duration: selected.duration_days,
        planId,
        renew: intent === "renew",
        current,
      });
  } catch {
    /* incomplete date */
  }
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />
      <input type="hidden" name="checkout_key" value={checkoutKey} />
      <div>
        <label htmlFor="staff-product">Access product</label>
        <select
          id="staff-product"
          name="plan_id"
          value={planId}
          required
          onChange={(e) => {
            setPlanId(e.target.value);
            setAmount(
              String(plans.find((p) => p.id === e.target.value)?.price ?? 0),
            );
          }}
          className="oura-input mt-2 w-full p-3"
        >
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · ${p.price} USD · {p.duration_days} day(s)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="staff-intent">Purchase type</label>
        <select
          id="staff-intent"
          name="intent"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          className="oura-input mt-2 w-full p-3"
        >
          <option value="buy">New pass — keep other passes</option>
          <option value="renew">
            Renew this product after its existing end date
          </option>
        </select>
      </div>
      <div>
        <label htmlFor="staff-start">Earliest start date</label>
        <input
          id="staff-start"
          name="start_date"
          type="date"
          min={today}
          required
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="oura-input mt-2 w-full p-3"
        />
      </div>
      {period && (
        <p role="status" className="rounded border p-3 text-sm">
          Access {period.start} through {period.end}, until 10 pm Jamaica time.
          Free Rewards membership and other passes remain unchanged.
        </p>
      )}
      <div>
        <label htmlFor="staff-method">Payment method</label>
        <select
          id="staff-method"
          name="payment_method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="oura-input mt-2 w-full p-3"
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="complimentary">Complimentary</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label htmlFor="staff-amount">Amount collected (USD)</label>
        <input
          id="staff-amount"
          name="amount"
          type="number"
          min={0}
          max={selected?.price}
          step="0.01"
          required
          value={method === "complimentary" ? "0" : amount}
          onChange={(e) => setAmount(e.target.value)}
          readOnly={method === "complimentary"}
          className="oura-input mt-2 w-full p-3"
        />
      </div>
      <div>
        <label htmlFor="staff-notes">
          Notes / discount or complimentary reason
        </label>
        <textarea
          id="staff-notes"
          name="payment_notes"
          required={
            method === "complimentary" ||
            Number(amount) < Number(selected?.price)
          }
          maxLength={1000}
          rows={2}
          className="oura-input mt-2 w-full p-3"
        />
      </div>
      <p className="text-sm opacity-80">
        Confirm the guest has accepted the facility waiver through the approved
        front desk process before granting access.
      </p>
      <Submit />
    </form>
  );
}
