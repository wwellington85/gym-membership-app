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
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bank_transfer" | "other" | "complimentary">("cash");
  const [paymentReason, setPaymentReason] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [startDate, setStartDate] = useState<string>(todayYmd());

  const selected = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const isPaid = (selected?.price ?? 0) > 0;

  const needsCompReason = recordPayment === "yes" && paymentMethod === "complimentary";

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
                <option value="bank_transfer">Bank transfer</option>
                <option value="complimentary">Complimentary</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {recordPayment === "yes" ? (
            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  {needsCompReason ? "Complimentary reason *" : "Payment notes"}
                </label>
                <textarea
                  name={needsCompReason ? "complimentary_reason" : "payment_notes"}
                  value={needsCompReason ? paymentReason : paymentNotes}
                  onChange={(e) =>
                    needsCompReason ? setPaymentReason(e.target.value) : setPaymentNotes(e.target.value)
                  }
                  required={needsCompReason}
                  className="w-full oura-input px-3 py-2"
                  rows={2}
                  placeholder={
                    needsCompReason
                      ? "Required: why this payment is complimentary"
                      : "Optional note"
                  }
                />
                {needsCompReason ? (
                  <div className="text-xs opacity-70">
                    Complimentary payments require a reason for audit history.
                  </div>
                ) : null}
              </div>

              {!needsCompReason ? (
                <input type="hidden" name="complimentary_reason" value="" />
              ) : (
                <input type="hidden" name="payment_notes" value={paymentNotes} />
              )}
            </div>
          ) : (
            <div>
              <input type="hidden" name="payment_notes" value="" />
              <input type="hidden" name="complimentary_reason" value="" />
            </div>
          )}

          <div className="text-xs opacity-70">
            Amount will be recorded as{" "}
            <span className="font-medium">
              {paymentMethod === "complimentary" && recordPayment === "yes"
                ? "$0.00 (complimentary)"
                : money(selected?.price ?? 0)}
            </span>
            .
          </div>
        </div>
      ) : null}

      {recordPayment === "yes" && !isPaid ? (
        <div className="rounded border p-2 text-xs opacity-70">
          This is a free plan. Payment entry is optional unless you want to track a complimentary reason.
        </div>
      ) : null}

      {!isPaid ? (
        <div className="oura-card p-3 space-y-3">
          <div className="font-medium">Payment record (optional)</div>
          <div className="text-sm opacity-70">If needed for audit, you can still record this as complimentary.</div>
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
                <option value="complimentary">Complimentary</option>
                <option value="other">Other</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </div>
          </div>

          {recordPayment === "yes" ? (
            <div className="space-y-1">
              <label className="text-sm font-medium">Complimentary reason *</label>
              <textarea
                name="complimentary_reason"
                value={paymentReason}
                onChange={(e) => setPaymentReason(e.target.value)}
                required
                className="w-full oura-input px-3 py-2"
                rows={2}
                placeholder="Required for complimentary entry"
              />
            </div>
          ) : null}
          <input type="hidden" name="payment_notes" value={paymentNotes} />
        </div>
      ) : null}

      <button type="submit" className="w-full rounded border px-3 py-2 hover:bg-white/5">
        Save plan
      </button>
    </form>
  );
}
