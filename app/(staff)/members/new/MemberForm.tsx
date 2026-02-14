"use client";

import { useMemo, useState } from "react";

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

export default function MemberForm({
  plans,
  action,
}: {
  plans: PlanRow[];
  action: (formData: FormData) => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [planId, setPlanId] = useState<string>("");

  const selected = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);
  const isPaid = (selected?.price ?? 0) > 0;

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">Full name *</label>
        <input name="full_name" required className="w-full oura-input px-3 py-2" placeholder="e.g., John Brown" />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Phone *</label>
        <input name="phone" required className="w-full oura-input px-3 py-2" placeholder="e.g., 876-555-1234" />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Email</label>
        <input name="email" type="email" className="w-full oura-input px-3 py-2" placeholder="optional" />
      </div>

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
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} • {formatDuration(p.duration_days)} • {formatPrice(p.price)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">Start date *</label>
        <input name="start_date" type="date" required defaultValue={today} className="w-full oura-input px-3 py-2" />
      </div>

      {isPaid ? (
        <div className="oura-card p-3 space-y-2">
          <div className="text-sm font-medium">Payment</div>
          <div className="text-sm opacity-70">Record the payment collected at the desk.</div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs opacity-70">Record payment?</label>
              <select name="collect_payment" className="w-full oura-input px-3 py-2" defaultValue="yes">
                <option value="">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs opacity-70">Method</label>
              <select name="payment_method" className="w-full oura-input px-3 py-2" defaultValue="cash">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online</option>
                <option value="comp">Comp</option>
              </select>
            </div>
          </div>

          <div className="text-xs opacity-70">
            Amount will be recorded automatically from the selected plan: <span className="font-medium">{formatPrice(selected?.price ?? 0)}</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-1">
        <label className="text-sm font-medium">Notes</label>
        <textarea name="notes" className="w-full oura-input px-3 py-2" rows={3} />
      </div>

      <button type="submit" className="w-full oura-button">
        Create Member
      </button>
    </form>
  );
}
