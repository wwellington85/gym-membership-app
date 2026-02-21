import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CountryFields } from "@/components/join/country-fields";
import { JoinSuccessBanner } from "@/components/join/success-banner";

type PlanCode = "rewards_free" | "club_day" | "club_weekly" | "club_monthly_95";

type JoinPlanOption = {
  code: string;
  label: string;
  name: string;
  price: number;
  duration_days: number;
  plan_type?: string | null;
  grants_access: boolean;
  discount_food: number;
  discount_watersports: number;
  discount_giftshop: number;
  discount_spa: number;
};

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

function isMissingVisibleOnJoinColumn(error: any) {
  return /visible_on_join/i.test(String(error?.message || ""));
}

function toJoinPlanLabel(code: string, name: string | null, price: number | null) {
  const normalized = code as PlanCode;
  if (normalized in PLAN_LABELS) return PLAN_LABELS[normalized];
  if (name && typeof price === "number") return `${name} — $${price}`;
  return name || code;
}

function money(v: number) {
  return v <= 0 ? "Free" : `$${v}`;
}

function formatDuration(days: number) {
  if (days >= 3650) return "No expiry";
  if (days === 1) return "1 day";
  if (days === 7) return "7 days";
  if (days === 30) return "30 days";
  return `${days} days`;
}

function planBlurb(p: JoinPlanOption) {
  if (!p.grants_access) return "Discounts only. No gym/pool facility access.";
  if ((p.plan_type || "").toLowerCase() === "pass") return "Full facility access for the selected pass period.";
  return "Full facility access plus member discounts.";
}

function toPercentText(v: number) {
  const n = Number.isFinite(v) ? v : 0;
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return `${pct}%`;
}

function discountBreakdown(p: JoinPlanOption) {
  const items = [
    { label: "Restaurant & Bar", value: Number(p.discount_food || 0) },
    { label: "Spa", value: Number(p.discount_spa || 0) },
    { label: "Gift Shop", value: Number(p.discount_giftshop || 0) },
    { label: "Watersports", value: Number(p.discount_watersports || 0) },
  ];
  const active = items.filter((i) => i.value > 0);
  if (active.length === 0) return "No outlet discounts";
  return active.map((i) => `${i.label} ${toPercentText(i.value)}`).join(" • ");
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams?: Promise<{
    err?: string;
    success?: string;
    full_name?: string;
    phone?: string;
    email?: string;
    requested_plan_code?: string;
    requested_start_date?: string;
    country?: string;
    other_country?: string;
    is_inhouse_guest?: string;
    notes?: string;
    waiver?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const today = todayJM();
  const adminForPlans = createAdminClient();
  let joinPlansError: string | null = null;

  const withVisibility = await adminForPlans
    .from("membership_plans")
    .select("code, name, price, duration_days, plan_type, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa")
    .eq("is_active", true)
    .eq("visible_on_join", true)
    .order("price", { ascending: true });

  const planRows =
    withVisibility.error && isMissingVisibleOnJoinColumn(withVisibility.error)
      ? (
          await adminForPlans
            .from("membership_plans")
            .select("code, name, price, duration_days, plan_type, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa")
            .eq("is_active", true)
            .order("price", { ascending: true })
        ).data
      : withVisibility.data;

  if (withVisibility.error && !isMissingVisibleOnJoinColumn(withVisibility.error)) {
    joinPlansError = withVisibility.error.message;
  }

  const joinPlanOptions: JoinPlanOption[] =
    (planRows ?? [])
      .map((p: any) => ({
        code: String(p.code || ""),
        label: toJoinPlanLabel(String(p.code || ""), p.name ?? null, p.price ?? null),
        name: String(p.name || p.code || ""),
        price: Number(p.price ?? 0),
        duration_days: Number(p.duration_days ?? 0),
        plan_type: p.plan_type ?? null,
        grants_access: !!p.grants_access,
        discount_food: Number(p.discount_food ?? 0),
        discount_watersports: Number(p.discount_watersports ?? 0),
        discount_giftshop: Number(p.discount_giftshop ?? 0),
        discount_spa: Number(p.discount_spa ?? 0),
      }))
      .filter((p) => p.code) || [];

  const fallbackOptions: JoinPlanOption[] = [
    {
      code: "rewards_free",
      label: PLAN_LABELS.rewards_free,
      name: "Travellers Rewards (Free)",
      price: 0,
      duration_days: 3650,
      plan_type: "rewards",
      grants_access: false,
      discount_food: 5,
      discount_watersports: 5,
      discount_giftshop: 5,
      discount_spa: 5,
    },
    {
      code: "club_day",
      label: PLAN_LABELS.club_day,
      name: "Travellers Club Day Pass",
      price: 25,
      duration_days: 1,
      plan_type: "pass",
      grants_access: true,
      discount_food: 10,
      discount_watersports: 10,
      discount_giftshop: 10,
      discount_spa: 10,
    },
    {
      code: "club_weekly",
      label: PLAN_LABELS.club_weekly,
      name: "Travellers Club Weekly Pass",
      price: 45,
      duration_days: 7,
      plan_type: "pass",
      grants_access: true,
      discount_food: 15,
      discount_watersports: 15,
      discount_giftshop: 15,
      discount_spa: 15,
    },
    {
      code: "club_monthly_95",
      label: PLAN_LABELS.club_monthly_95,
      name: "Travellers Club Monthly",
      price: 95,
      duration_days: 30,
      plan_type: "club",
      grants_access: true,
      discount_food: 20,
      discount_watersports: 15,
      discount_giftshop: 15,
      discount_spa: 15,
    },
  ];

  const selectablePlans = joinPlanOptions.length > 0 ? joinPlanOptions : fallbackOptions;
  const prefillPlan = sp.requested_plan_code || selectablePlans[0]?.code || "rewards_free";
  const prefillStart = sp.requested_start_date || today;
  const prefillCountry = sp.country || "Jamaica";
  const prefillWaiver = sp.waiver === "1";

  async function submitApplication(formData: FormData) {
    "use server";

    // Honeypot (bots fill this; humans won't)
    const website = String(formData.get("website") || "").trim();
    if (website) redirect("/member"); // pretend success

    const full_name = String(formData.get("full_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();

    const requested_plan_code = String(formData.get("requested_plan_code") || "").trim();

    let requested_start_date = String(formData.get("requested_start_date") || "").trim(); // YYYY-MM-DD or ""
    const country = String(formData.get("country") || "Jamaica").trim();
    const other_country = String(formData.get("other_country") || "").trim();
    const is_inhouse_guest = String(formData.get("is_inhouse_guest") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const waiverAccepted = String(formData.get("waiver") || "").trim() === "on";

    const password = String(formData.get("password") || "");
    const password2 = String(formData.get("password2") || "");

    const fail = (message: string): never => {
      const params = new URLSearchParams();
      params.set("err", message);
      if (full_name) params.set("full_name", full_name);
      if (phone) params.set("phone", phone);
      if (email) params.set("email", email);
      if (requested_plan_code) params.set("requested_plan_code", requested_plan_code);
      if (requested_start_date) params.set("requested_start_date", requested_start_date);
      if (country) params.set("country", country);
      if (other_country) params.set("other_country", other_country);
      if (is_inhouse_guest) params.set("is_inhouse_guest", is_inhouse_guest);
      if (notes) params.set("notes", notes);
      if (waiverAccepted) params.set("waiver", "1");
      return redirect(`/join?${params.toString()}`);
    };

    if (!full_name) fail("Please enter your name");

    const allowedCodes = new Set(selectablePlans.map((p) => p.code));
    if (!requested_plan_code || !allowedCodes.has(requested_plan_code)) {
      fail("Please select a membership option");
    }

    if (email && !email.includes("@")) {
      fail("Please enter a valid email");
    }

    if (!password || password.length < 8) {
      fail("Please choose a password (8+ characters)");
    }
    if (password !== password2) {
      fail("Passwords do not match");
    }

    const isAccess =
      selectablePlans.find((p) => p.code === requested_plan_code)?.grants_access ??
      ACCESS_PLANS.includes(requested_plan_code as PlanCode);

    // Normalize start date: Free plan should NOT set one.
    if (!isAccess) requested_start_date = "";

    // Start date is required only for access plans
    if (isAccess && !requested_start_date) {
      fail("Please select a start date");
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    // 1) Create user via service role (confirms email immediately).
    // If the email already exists, fall back to signing in and continuing.
    let userId: string | null = null;
    let alreadySignedIn = false;

    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        is_member: true,
        full_name,
        phone,
      },
    });

    if (createErr || !createdUser?.user?.id) {
      const msg = (createErr as any)?.message || "";
      const isNetwork =
        (createErr as any)?.status === 0 ||
        /fetch failed|timeout|timed\s*out|ENOTFOUND|ECONNRESET|EAI_AGAIN/i.test(msg);

      // If network dropped, the user may have been created but we didn't receive the response.
      // Try signing in; if it works, continue.
      if (isNetwork) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          console.error("JOIN createUser network error:", createErr);
          fail("Connection issue while creating your account. Please try again.");
        }

        alreadySignedIn = true;

        const { data: ures, error: uerr } = await supabase.auth.getUser();
        const signedInUserId = ures?.user?.id ?? null;
        if (uerr || !signedInUserId) {
          fail(uerr?.message || "Could not load your account");
        }
        userId = signedInUserId;
      } else {
        const alreadyExists =
          /already\s*registered|already\s*exists|user\s*already\s*exists|duplicate/i.test(msg);

        if (!alreadyExists) {
          console.error("JOIN createUser error:", createErr);
          const friendly =
            msg || "Could not create account. Please check your connection and try again.";
          fail(friendly);
        }

        // Existing user path: sign in and continue
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) {
          console.error("JOIN signIn (existing user) error:", signInErr);
          redirect(`/auth/login?returnTo=/join&email=${encodeURIComponent(email)}&err=That%20email%20is%20already%20registered.%20Please%20log%20in%20to%20continue.`);
        }

        alreadySignedIn = true;

        const { data: ures, error: uerr } = await supabase.auth.getUser();
        const existingUserId = ures?.user?.id ?? null;
        if (uerr || !existingUserId) {
          fail(uerr?.message || "Could not load your account");
        }

        userId = existingUserId;
      }
    } else {
      userId = createdUser.user.id;
    }

    if (!userId) {
      fail("Could not determine user id");
    }

    // 2) Ensure members row exists (service role bypasses members_insert_staff RLS restriction)
    {
      const { error: memberErr } = await admin
        .from("members")
        .upsert(
          {
            user_id: userId,
            email,
            full_name,
            phone: phone || "",
            notes: null,
          },
          { onConflict: "user_id" }
        );

      if (memberErr) {
        console.error("JOIN ensure member error:", memberErr);
        fail(memberErr.message);
      }
    }

    // 3) Sign them in (sets cookies/session so /member works immediately)
    if (!alreadySignedIn) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) {
        console.error("JOIN signIn error:", signInErr);
        fail(signInErr.message);
      }
    }

    // 4) Write membership application (idempotent)
    const payload: any = {
      user_id: userId,
      full_name,
      phone: phone || null,
      email: email || null,
      requested_plan_code,
      notes: notes || null,
      country: country || null,
      other_country: other_country || null,
      is_inhouse_guest: is_inhouse_guest === "yes" ? true : is_inhouse_guest === "no" ? false : null,
    };

    payload.requested_start_date = requested_start_date || null;

    if (waiverAccepted) {
      payload.waiver_accepted = true;
      payload.waiver_accepted_at = new Date().toISOString();
    }
    // Write membership application (idempotent) using upsert.
    payload.status = "pending";
    const { error: appUpsertErr } = await supabase.from("membership_applications").upsert(payload, {
      onConflict: "email,requested_start_date,status",
      ignoreDuplicates: false,
    });
    if (appUpsertErr) fail(appUpsertErr.message);
    // 5) Ensure memberships row exists (default to rewards_free)
    {
      const { data: memRow, error: memRowErr } = await admin
        .from("members")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      const memberId = memRow?.id ?? null;
      if (memRowErr || !memberId) {
        console.error("JOIN members lookup for membership bootstrap error:", memRowErr);
        fail(memRowErr?.message || "Could not load member record");
      }

      const { data: rewards, error: rewardsErr } = await admin
        .from("membership_plans")
        .select("id, duration_days")
        .eq("code", "rewards_free")
        .maybeSingle();

      if (rewardsErr) {
        console.error("JOIN rewards_free plan lookup error:", rewardsErr);
      }

      const todayISO = todayJM();
      const duration = Number(rewards?.duration_days || 3650);
      const paidThrough = addDaysISO(todayISO, duration);

      const { error: upsertMsErr } = await admin
        .from("memberships")
        .upsert(
          {
            member_id: memberId,
            plan_id: rewards?.id ?? null,
            status: "active",
            start_date: todayISO,
            paid_through_date: paidThrough,
          },
          { onConflict: "member_id" }
        );

      if (upsertMsErr) {
        console.error("JOIN memberships upsert error:", upsertMsErr);
      }
    }

    // Route based on chosen plan
    if (requested_plan_code !== "rewards_free") {
      redirect("/member/upgrade?plan=" + encodeURIComponent(requested_plan_code));
    }

    redirect("/member");
  }

  return (
    <div className="w-full space-y-4 py-5 sm:py-6">
      <div>
        <h1 className="text-xl font-semibold">Travellers Club Signup</h1>
        <p className="text-sm opacity-70">
          Join Travellers Rewards (free) for member discounts, or choose a Travellers Club pass for full facility access.
          Activation is completed after verification/payment at the front desk.
        </p>
      </div>

      {sp.err ? (
        <div
          role="alert"
          aria-live="polite"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm font-medium text-red-900"
        >
          Please check and try again: {sp.err}
        </div>
      ) : null}
      {sp.success === "1" ? <JoinSuccessBanner /> : null}
      {joinPlansError ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Plan list could not be fully loaded. Showing default options.
        </div>
      ) : null}

      <form action={submitApplication} className="space-y-3 rounded border p-4">
        {/* Honeypot hidden field */}
        <div className="hidden">
          <label className="text-sm">Website</label>
          <input name="website" className="hidden" tabIndex={-1} autoComplete="off" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Full name</label>
          <input name="full_name" className="w-full oura-input px-3 py-2" placeholder="Your name" required defaultValue={sp.full_name || ""} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Phone (optional)</label>
          <input name="phone" className="w-full oura-input px-3 py-2" placeholder="876-555-1234" defaultValue={sp.phone || ""} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input name="email" required type="email" className="w-full oura-input px-3 py-2" placeholder="you@email.com" defaultValue={sp.email || ""} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Create a password</label>
          <input name="password" type="password" required className="w-full oura-input px-3 py-2" placeholder="At least 8 characters" minLength={8} />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Confirm password</label>
          <input name="password2" type="password" required className="w-full oura-input px-3 py-2" placeholder="Re-enter password" minLength={8} />
        </div>

        <div className="text-xs opacity-60">You’ll use this to log in and view your Membership Card and points.</div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Choose an option</label>
          <div className="space-y-2">
            {selectablePlans.map((p) => {
              return (
                <label
                  key={p.code}
                  className="flex cursor-pointer items-start gap-3 rounded border border-white/20 p-3 transition hover:border-white/40"
                >
                  <input
                    type="radio"
                    name="requested_plan_code"
                    value={p.code}
                    defaultChecked={p.code === prefillPlan}
                    className="mt-1 h-4 w-4 shrink-0"
                    required
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="mt-1 text-xs opacity-80">{planBlurb(p)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{money(p.price)}</div>
                      <div className="text-xs opacity-70">{formatDuration(p.duration_days)}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs opacity-75">{discountBreakdown(p)}</div>
                </label>
              );
            })}
          </div>
          <p className="text-xs opacity-60">
            Club passes include full facility access + member discounts. Rewards (Free) provides discounts only.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Preferred start date</label>
          <div className="w-full overflow-hidden rounded-xl">
            <input
              name="requested_start_date"
              type="date"
              className="join-date-input block w-full min-w-0 max-w-full oura-input px-3 py-2"
              defaultValue={prefillStart}
            />
          </div>
          <p className="text-xs opacity-60">Required for Club passes. Optional for Rewards (Free).</p>
        </div>

        <CountryFields initialCountry={prefillCountry} initialOtherCountry={sp.other_country || ""} />

        <div className="space-y-1">
          <label className="text-sm font-medium">Are you staying at the hotel right now?</label>
          <select name="is_inhouse_guest" className="w-full oura-input px-3 py-2" defaultValue={sp.is_inhouse_guest || ""}>
            <option value="">Select</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
          <p className="text-xs opacity-60">Optional. Helps staff understand your access needs.</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Notes (optional)</label>
          <textarea name="notes" className="w-full oura-input px-3 py-2" placeholder="Any info to help staff (e.g., best time to call)" rows={3} defaultValue={sp.notes || ""} />
        </div>

        <div className="space-y-2 rounded border p-3">
          <label className="flex items-start gap-2 text-sm">
            <input name="waiver" type="checkbox" required className="mt-1" defaultChecked={prefillWaiver} />
            <span>
              I understand the risks involved with using the facilities (including the gym) and release Travellers Beach Resort from liability.
            </span>
          </label>
          <div className="text-xs opacity-60">You must accept to submit your request.</div>
        </div>

        <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">Submit signup</button>
      </form>
    </div>
  );
}

function addDaysISO(baseISO: string, days: number) {
  const d = new Date(baseISO + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
