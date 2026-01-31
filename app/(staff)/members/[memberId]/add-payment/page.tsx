export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AddPaymentPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { memberId } = await params;

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone")
    .eq("id", memberId)
    .single();

  if (!member) redirect("/members");

  // IMPORTANT: include membership id
  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id, paid_through_date, membership_plan:membership_plan(name, price)")
    .eq("member_id", memberId)
    .maybeSingle();

  async function addPayment(formData: FormData) {
    "use server";

    const supabase = await createClient();

    // Re-fetch membership in server action so we have it reliably on submit
    const { data: mship, error: mshipErr } = await supabase
      .from("memberships")
      .select("id")
      .eq("member_id", memberId)
      .maybeSingle();

    if (mshipErr || !mship?.id) {
      throw new Error("No membership found for this member. Create a membership first.");
    }

    const amount = Number(formData.get("amount") || 0);
    const paid_on = String(formData.get("paid_on") || "").trim();
    const payment_method = String(formData.get("payment_method") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;

    if (!paid_on) throw new Error("Missing paid_on");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");

    const { error } = await supabase.from("payments").insert({
      membership_id: mship.id,
      member_id: memberId,
      amount,
      paid_on,
      payment_method,
      notes,
    });

    if (error) throw new Error(`Payment insert failed: ${error.message}`);

    redirect(`/members/${memberId}\?payment=saved`);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Add Payment</h1>
        <p className="text-sm opacity-70">
          {member.full_name} • {member.phone}
        </p>
      </div>

      <div className="rounded border p-3 text-sm">
        <div className="font-medium">Current Membership</div>
        <div className="mt-1 opacity-80">
          {membership?.membership_plan?.name ?? "—"}
          {membership?.membership_plan?.price != null ? ` • $${membership.membership_plan.price}` : ""}
        </div>
        <div className="mt-1 text-xs opacity-70">
          Paid-through: {membership?.paid_through_date ?? "—"}
        </div>
        {membershipError ? (
          <div className="mt-2 text-xs opacity-70">Membership load error: {membershipError.message}</div>
        ) : null}
        {!membership ? (
          <div className="mt-2 text-xs opacity-70">
            No membership row found for this member yet.
          </div>
        ) : null}
      </div>

      <form action={addPayment} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Paid on *</label>
          <input name="paid_on" type="date" required className="w-full rounded border px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Amount (USD) *</label>
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={membership?.membership_plan?.price ?? ""}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Payment method</label>
          <select name="payment_method" className="w-full rounded border px-3 py-2">
            <option value="">Select</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea name="notes" className="w-full rounded border px-3 py-2" rows={3} />
        </div>

        <button type="submit" className="w-full rounded border px-3 py-2 hover:bg-gray-50">
          Save Payment
        </button>
      </form>
    </div>
  );
}
// VERCEL_TEST_1769901451
