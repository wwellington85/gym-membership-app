import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function NewMemberPage() {
  const supabase = await createClient();

  const { data: plans, error: plansError } = await supabase
    .from("membership_plans")
    .select("id, name, code, price, duration_days, plan_type")
    .eq("is_active", true)
    .order("duration_days", { ascending: true });

  async function createMember(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const full_name = String(formData.get("full_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim() || null;
    const notes = String(formData.get("notes") || "").trim() || null;

    const plan_id = String(formData.get("plan_id") || "");
    const start_date = String(formData.get("start_date") || "").trim();

    if (!full_name || !phone || !plan_id || !start_date) {
      // Simple fallback: send them back to the form if missing required fields
      redirect("/members/new");
    }

    const { data: member, error: memberError } = await supabase
      .from("members")
      .insert({ full_name, phone, email, notes })
      .select("id")
      .single();

    if (memberError || !member) {
      redirect("/members/new");
    }

    const { error: membershipError } = await supabase
      .from("memberships")
      .insert({
        member_id: member.id,
        plan_id,
        start_date,
        // paid_through_date will be set by trigger
        // status will be set by trigger
      });

    if (membershipError) {
      // If membership insert fails, you may want to delete member to avoid orphan record.
      // We'll keep it simple for MVP.
      redirect(`/members/${member.id}`);
    }

    redirect(`/members/${member.id}`);
  }


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
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Add Club Member</h1>
        <p className="text-sm opacity-70">Create a profile and assign Rewards, Club, or a Pass</p>
      </div>

      {plansError ? (
        <div className="rounded border p-3 text-sm">
          Could not load membership plans.
          <div className="mt-1 text-xs opacity-70">{plansError.message}</div>
        </div>
      ) : null}

      <form action={createMember} className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Full name *</label>
          <input
            name="full_name"
            required
            className="w-full rounded border px-3 py-2"
            placeholder="e.g., John Brown"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Phone *</label>
          <input
            name="phone"
            required
            className="w-full rounded border px-3 py-2"
            placeholder="e.g., 876-555-1234"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            name="email"
            type="email"
            className="w-full rounded border px-3 py-2"
            placeholder="optional"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Membership *</label>
          <select name="plan_id" required className="w-full rounded border px-3 py-2">
            <option value="">Select a plan</option>
            {(plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {formatType(p.plan_type)}: {p.name} • {formatDuration(p.duration_days)} • {formatPrice(p.price)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Start date *</label>
          <input name="start_date" type="date" required className="w-full rounded border px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea name="notes" className="w-full rounded border px-3 py-2" rows={3} />
        </div>

        <button type="submit" className="w-full rounded border px-3 py-2 hover:bg-gray-50">
          Create Member
        </button>
      </form>
    </div>
  );
}
