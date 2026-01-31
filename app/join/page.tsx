import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PlanCode = "daily" | "weekly" | "monthly";

const PLAN_LABELS: Record<PlanCode, string> = {
  daily: "Daily — $15",
  weekly: "Weekly — $45",
  monthly: "Monthly — $95",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams?: Promise<{ err?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  const todayJM = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Jamaica", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  async function submitApplication(formData: FormData) {
    "use server";

    // Honeypot (bots fill this; humans won't)
    const website = String(formData.get("website") || "").trim();
    if (website) redirect("/join/success"); // pretend success

    const full_name = String(formData.get("full_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const requested_plan_code = String(formData.get("requested_plan_code") || "").trim() as PlanCode;
    const requested_start_date = String(formData.get("requested_start_date") || "").trim(); // YYYY-MM-DD or ""
    const notes = String(formData.get("notes") || "").trim();

    if (!full_name) redirect("/join?err=Please%20enter%20your%20name");
    if (!requested_plan_code || !["daily", "weekly", "monthly"].includes(requested_plan_code)) {
      redirect("/join?err=Please%20select%20a%20plan");
    }

    // basic email format check (optional)
    if (email && !email.includes("@")) redirect("/join?err=Please%20enter%20a%20valid%20email");

    const supabase = await createClient();

    const payload: any = {
      full_name,
      phone: phone || null,
      email: email || null,
      requested_plan_code,
      notes: notes || null,
    };

    if (requested_start_date) payload.requested_start_date = requested_start_date;

    const { error } = await supabase.from("membership_applications").insert(payload);

    if (error) redirect(`/join?err=${encodeURIComponent(error.message)}`);

    redirect("/join/success");
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Gym Membership Request</h1>
        <p className="text-sm opacity-70">
          Submit your details. Membership is activated after payment at the front desk.
        </p>
      </div>

      {sp.err ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">Error: {sp.err}</div>
      ) : null}

      <form action={submitApplication} className="space-y-3 rounded border p-4">
        {/* Honeypot hidden field */}
        <div className="hidden">
          <label className="text-sm">Website</label>
          <input name="website" className="w-full rounded border px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Full name</label>
          <input
            name="full_name"
            className="w-full rounded border px-3 py-2"
            placeholder="Your name"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Phone (optional)</label>
          <input name="phone" className="w-full rounded border px-3 py-2" placeholder="+1 (___) ___-____" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input name="email" required type="email" className="w-full rounded border px-3 py-2" placeholder="you@email.com" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Choose a plan</label>
          <select name="requested_plan_code" className="w-full rounded border px-3 py-2" defaultValue="monthly">
            <option value="monthly">{PLAN_LABELS.monthly}</option>
            <option value="weekly">{PLAN_LABELS.weekly}</option>
            <option value="daily">{PLAN_LABELS.daily}</option>
          </select>
          <p className="text-xs opacity-60">Payment is collected at the front desk.</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Preferred start date</label>
          <input name="requested_start_date" required type="date" className="w-full rounded border px-3 py-2"  defaultValue={todayJM}/>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes (optional)</label>
          <textarea
            name="notes"
            className="w-full rounded border px-3 py-2"
            placeholder="Any info to help staff (e.g., best time to call)"
            rows={3}
          />
        </div>

        <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Submit request
        </button>

        <div className="space-y-2 rounded border p-3">
          <label className="flex items-start gap-2 text-sm">
            <input name="waiver" type="checkbox" required className="mt-1" />
            <span>
              I understand the risks involved with gym use and release Travellers Beach Resort from liability.
            </span>
          </label>
          <div className="text-xs opacity-60">You must accept to submit your request.</div>
        </div>


        <div className="text-xs opacity-60">
          By submitting, you agree that Travellers Beach Resort may contact you about your gym membership.
        </div>
      </form>
    </div>
  );
}
