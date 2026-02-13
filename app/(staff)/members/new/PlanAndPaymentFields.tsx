"use client";

import * as React from "react";

type PlanRow = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  plan_type?: string | null;
  code?: string | null;
};

function formatPrice(price: number) {
  return price === 0 ? "Free" : `$${price}`;
}

function formatDuration(days: number) {
  if (days === 1) return "1 day";
  if (days === 7) return "7 days";
  if (days === 30) return "30 days";
  if (days >= 3650) return "No expiry";
  return `${days} days`;
}

function formatType(t?: string | null) {
  if (t === "rewards") return "Rewards";
  if (t === "club") return "Club";
  if (t === "pass") return "Pass";
  return "Plan";
}

export function PlanAndPaymentFields({ plans }: { plans: PlanRow[] }) {
  const [planId, setPlanId] = React.useState<string>("");
  const selected = React.useMemo(
    () => plans.find((p) => p.id === planId) ?? null,
    [plans, planId]
  );

  const isPaid = (selected?.price ?? 0) > 0;

  // default: if paid plan selected, check "record payment" and auto-fill amount
  const [recordPayment, setRecordPayment] = React.useState<boolean>(false);
  const [amount, setAmount] = React.useState<string>("");

  React.useEffect(() => {
    if (isPaid) {
      setRecordPayment(true);
      setAmount(String(selected?.price ?? ""));
    } else {
      setRecordPayment(false);
      setAmount("");
    }
  }, [isPaid, selected?.price]);

  return (
    <>
      <div className="space-y-1">
        <label className="text-sm font-medium">Membership *</label>
        <select
          name="plan_id"
          required
          className="w-full oura-input px-3 py-2"
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
        >
          <option value="">Select a plan</option>
          {(plans ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {formatType(p.plan_type)}: {p.name} • {formatDuration(p.duration_days)} • {formatPrice(p.price)}
            </option>
          ))}
        </select>
      </div>

      {isPaid ? (
        <div className="rounded border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="record_payment"
              name="record_payment"
              type="checkbox"
              checked={recordPayment}
              onChange={(e) => setRecordPayment(e.target.checked)}
            />
            <label htmlFor="record_payment" className="text-sm font-medium">
              Record payment now
            </label>
          </div>

          {recordPayment ? (
            <>
              <div className="space-y-1">
                <label className="text-sm font-medium">Payment method *</label>
                <select name="payment_method" required className="w-full oura-input px-3 py-2" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">Amount *</label>
                <input
                  name="payment_amount"
                  required
                  inputMode="decimal"
                  className="w-full oura-input px-3 py-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <div className="text-xs opacity-70">
                  Defaults to the plan price. You can override if needed.
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
