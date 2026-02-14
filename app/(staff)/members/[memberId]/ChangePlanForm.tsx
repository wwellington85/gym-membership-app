"use client";

import { useMemo, useState } from "react";

type PlanRow = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  plan_type?: string | null;
};

function money(v?: number | null) {
  const n = typeof v === "number" ? v : 0;
  return n === 0 ? "Free" : `$${n}`;
}

function formatDuration(days: number) {
  if (days === 1) return "1 day";
  if (days === 7) return "7 days";
  if (days === 30) return "30 days";
  if (days >= 3650) return "No expiry";
  return `${days} days`;
}

function todayYmd() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function ChangePlanForm({
  memberId,
  currentPlanId,
  plans,
  action,
}: {
  memberId: string;
  currentPlanId?: string | null;
  plans: PlanRow[];
  action: (formData: FormData) => void;
}) {
  const [planId, setPlanId] = useState<string>(currentPlanId ?? "");
  const [recordPayment, setRecordPayment] = useState<"no" | "yes">("no");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [startDate, setStartDate] = useState<string>(todayYmd());

  const selected = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const isPaid = (selected?.price ?? 0) > 0;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="member_id" value={memberId} />

      <div className="space-y-1">
        <label className="text-sm font-medium">Plan</label>
        <select
          name="plan_id"
          required
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            setRecordPayment("no");
          }}
          className="w-full oura-input px-3 py-2"
        >
          <option value="">Select a plan</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} • {formatDuration(p.duration_days)} • {money(p.price)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Start date</label>
        <input
          name="start_date"
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full oura-input px-3 py-2"
        />
      </div>

      {isPaid ? (
        <div className="oura-card p-3 space-y-3">
          <div className="font-medium">Payment (optional)</div>
          <div className="text-sm opacity-70">If you collected payment at the desk, record it now.</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Record payment?</label>
              <select
                name="record_payment"
                value={recordPayment}
                onChange={(e) => setRecordPayment(e.target.value as any)}
                className="w-full oura-input px-3 py-2"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Method</label>
              <select
                name="payment_method"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full oura-input px-3 py-2"
                disabled={recordPayment !== "yes"}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          <div className="text-xs opacity-70">
            Amount will be recorded as <span className="font-medium">{money(selected?.price ?? 0)}</span>.
          </div>
        </div>
      ) : null}

      <button type="submit" className="w-full rounded border px-3 py-2 hover:bg-white/5">
        Save plan
      </button>
    </form>
  );
}
