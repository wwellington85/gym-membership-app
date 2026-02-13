import { PlanAndPaymentFields } from "./PlanAndPaymentFields";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

type PlanRow = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  plan_type?: string | null;
  code?: string | null;
};

export default async function NewMemberPage() {
  const supabase = await createClient();

  // Load plans via admin client (avoids RLS issues)
  const { data: plansRaw, error: plansError } = await supabase
    .from("membership_plans")
    .select("id,name,price,duration_days,plan_type,code")
      .eq("is_active", true)
    .order("price", { ascending: true });

  const plans = (plansRaw as PlanRow[] | null) ?? null;

  async function createMember(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const full_name = String(formData.get("full_name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const emailRaw = String(formData.get("email") ?? "").trim();
    const notesRaw = String(formData.get("notes") ?? "").trim();
    const plan_id = String(formData.get("plan_id") ?? "").trim();
    const start_date = String(formData.get("start_date") ?? "").trim();

    if (!full_name || !phone || !plan_id || !start_date) {
      redirect("/members/new?error=missing_fields");
    }

    const email = emailRaw.length ? emailRaw : null;
    const notes = notesRaw.length ? notesRaw : null;

    // Create member
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .insert({ full_name, phone, email, notes } as any)
      .select("*")
      .single();

    if (memberErr || !member) {
      console.error("[members/new] member insert failed:", memberErr);
      redirect("/members/new?error=member_insert_failed");
    }

    // Fetch plan row (code is optional, used by some schemas/triggers)
    const { data: planRow, error: planErr } = await supabase
      .from("membership_plans")
      .select("id,code")
      .eq("id", plan_id)
      .maybeSingle();

    if (planErr || !planRow) {
      redirect(`/members/${member.id}`);
    }


    // Create membership row
    // A membership row may already exist (trigger/default free membership),
    // and memberships has a unique constraint on member_id.
    // So we UPSERT/UPDATE instead of INSERT.

    let membershipErr: any = null;

    // Try starts_on first (common), then fall back to start_date
    {
      const r = await supabase
        .from("memberships")
        .upsert(
          { member_id: member.id, plan_id, starts_on: start_date } as any,
          { onConflict: "member_id" }
        );
      membershipErr = r.error;
    }

    // If starts_on column doesn't exist (PGRST204) or other schema mismatch, try start_date
    if (membershipErr && membershipErr.code === "PGRST204") {
      const r2 = await supabase
        .from("memberships")
        .upsert(
          { member_id: member.id, plan_id, start_date } as any,
          { onConflict: "member_id" }
        );
      membershipErr = r2.error;
    }

    // If upsert isn't allowed by RLS or any other error, try explicit update as last resort
    if (membershipErr) {
      const u1 = await supabase
        .from("memberships")
        .update({ plan_id, starts_on: start_date } as any)
        .eq("member_id", member.id);
      if (!u1.error) membershipErr = null;
    }

    if (membershipErr) {
      const u2 = await supabase
        .from("memberships")
        .update({ plan_id, start_date } as any)
        .eq("member_id", member.id);
      membershipErr = u2.error ?? membershipErr;
    }

    if (membershipErr) {
      console.error("[members/new] membership upsert/update failed:", membershipErr);
      redirect("/members/" + member.id + "?membership_error=1");
    }

    redirect("/members/" + member.id);
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
          <div className="mt-1 text-xs opacity-70">{String((plansError as any)?.message ?? plansError)}</div>
        </div>
      ) : null}

      <form action={createMember} className="space-y-3">
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

        <PlanAndPaymentFields plans={(plans ?? []) as any} />

        <div className="space-y-1">
          <label className="text-sm font-medium">Start date *</label>
          <input name="start_date" type="date" required className="w-full oura-input px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes</label>
          <textarea name="notes" className="w-full oura-input px-3 py-2" rows={3} />
        </div>

        <button type="submit" className="w-full rounded border px-3 py-2 hover:bg-gray-50">
          Create Member
        </button>
      </form>
    </div>
  );
}
