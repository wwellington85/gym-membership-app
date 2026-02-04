import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CountryFields } from "@/components/join/country-fields";

type PlanCode = "rewards_free" | "club_day" | "club_weekly" | "club_monthly_95";

const PLAN_LABELS: Record<PlanCode, string> = {
  rewards_free: "Travellers Rewards (Free) — Discounts only",
  club_day: "Travellers Club Day Pass — $25",
  club_weekly: "Travellers Club Weekly Pass — $45",
  club_monthly_95: "Travellers Club Monthly — $95",
};

const ACCESS_PLANS: PlanCode[] = ["club_day", "club_weekly", "club_monthly_95"];

function todayJM(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams?: Promise<{ err?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const today = todayJM();

  async function submitApplication(formData: FormData) {
    "use server";

    // Honeypot (bots fill this; humans won't)
    const website = String(formData.get("website") || "").trim();
    if (website) redirect("/member"); // pretend success

    const full_name = String(formData.get("full_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "")
      .trim()
      .toLowerCase();

    const requested_plan_code = String(formData.get("requested_plan_code") || "")
      .trim() as PlanCode;

    const requested_start_date = String(formData.get("requested_start_date") || "").trim(); // YYYY-MM-DD or ""
    const country = String(formData.get("country") || "Jamaica").trim();
    const other_country = String(formData.get("other_country") || "").trim();
    const is_inhouse_guest = String(formData.get("is_inhouse_guest") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    const password = String(formData.get("password") || "");
    const password2 = String(formData.get("password2") || "");

    if (!full_name) redirect("/join?err=Please%20enter%20your%20name");

    const allowed: PlanCode[] = ["rewards_free", "club_day", "club_weekly", "club_monthly_95"];
    if (!requested_plan_code || !allowed.includes(requested_plan_code)) {
      redirect("/join?err=Please%20select%20a%20membership%20option");
    }

    // basic email format check (optional)
    if (email && !email.includes("@")) redirect("/join?err=Please%20enter%20a%20valid%20email");

    if (!password || password.length < 8) redirect("/join?err=Please%20choose%20a%20password%20(8%2B%20characters)");
    if (password != password2) redirect("/join?err=Passwords%20do%20not%20match");

    // Start date is required only for access plans (Club passes)
    const isAccess = ACCESS_PLANS.includes(requested_plan_code);
    if (isAccess && !requested_start_date) {
      redirect("/join?err=Please%20select%20a%20start%20date");
    }

    const supabase = await createClient();

    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpErr) redirect(`/join?err=${encodeURIComponent(signUpErr.message)}`);
    const userId = signUpData?.user?.id ?? null;


    const payload: any = {
      user_id: userId,
      full_name,
      phone: phone || null,
      email: email || null,
      requested_plan_code,
      notes: notes || null,
    };

    if (requested_start_date) payload.requested_start_date = requested_start_date;
    payload.country = country || null;
    payload.other_country = other_country || null;
    payload.is_inhouse_guest = is_inhouse_guest === "yes" ? true : is_inhouse_guest === "no" ? false : null;


    const { data: created, error } = await supabase.from("membership_applications").insert(payload).select("id").single();

    if (error) redirect(`/join?err=${encodeURIComponent(error.message)}`);

    redirect("/member");
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Travellers Club Signup</h1>
        <p className="text-sm opacity-70">
          Join Travellers Rewards (free) for member discounts, or choose a Travellers Club pass for full facility access.
          Activation is completed after verification/payment at the front desk.
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
          <input
            name="phone"
            className="w-full rounded border px-3 py-2"
            placeholder="876-555-1234"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input
            name="email"
            required
            type="email"
            className="w-full rounded border px-3 py-2"
            placeholder="you@email.com"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Create a password</label>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded border px-3 py-2"
            placeholder="At least 8 characters"
            minLength={8}
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Confirm password</label>
          <input
            name="password2"
            type="password"
            required
            className="w-full rounded border px-3 py-2"
            placeholder="Re-enter password"
            minLength={8}
          />
        </div>

        <div className="text-xs opacity-60">
          You’ll use this to log in and view your Membership Card and points.
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Choose an option</label>
          <select
            name="requested_plan_code"
            className="w-full rounded border px-3 py-2"
            defaultValue="rewards_free"
          >
            <option value="rewards_free">{PLAN_LABELS.rewards_free}</option>
            <option value="club_day">{PLAN_LABELS.club_day}</option>
            <option value="club_weekly">{PLAN_LABELS.club_weekly}</option>
            <option value="club_monthly_95">{PLAN_LABELS.club_monthly_95}</option>
          </select>
          <p className="text-xs opacity-60">
            Club passes include full facility access + member discounts. Rewards (Free) provides discounts only.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Preferred start date</label>
          <input
            name="requested_start_date"
            type="date"
            className="w-full rounded border px-3 py-2"
            defaultValue={today}
          />
          <p className="text-xs opacity-60">
            Required for Club passes. Optional for Rewards (Free).
          </p>
        </div>
        <CountryFields />
<div className="space-y-1">
          <label className="text-sm font-medium">Are you staying at the hotel right now?</label>
          <select name="is_inhouse_guest" className="w-full rounded border px-3 py-2" defaultValue="">
            <option value="">Select</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <p className="text-xs opacity-60">Optional. Helps staff understand your access needs.</p>
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

        <div className="space-y-2 rounded border p-3">
          <label className="flex items-start gap-2 text-sm">
            <input name="waiver" type="checkbox" required className="mt-1" />
            <span>
              I understand the risks involved with using the facilities (including the gym) and release Travellers Beach Resort from liability.
            </span>
          </label>
          <div className="text-xs opacity-60">You must accept to submit your request.</div>
        </div>

        <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Submit signup
        </button>

        <div className="text-xs opacity-60">
          By submitting, you agree that Travellers Beach Resort may contact you about your membership.
        </div>
      </form>
    </div>
  );
}
