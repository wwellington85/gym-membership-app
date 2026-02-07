import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { safeReturnTo } from "@/lib/auth/return-to";

type Role = "admin" | "front_desk" | "security";


function withParam(url: string, key: string, value: string) {
  const [path, qs = ""] = url.split("?");
  const params = new URLSearchParams(qs);
  params.set(key, value);
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

// YYYY-MM-DD + N days -> YYYY-MM-DD (UTC-safe)
function addDays(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export default async function ConvertApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams?: Promise<{ back?: string; err?: string }>;
}) {
  const { applicationId } = await params;
  const sp = (await searchParams) ?? {};
  const backTo = safeReturnTo(sp.back || "/applications");
  const backEncoded = encodeURIComponent(backTo);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");

  const role = staffProfile.role as Role;
  if (role !== "admin" && role !== "front_desk") redirect("/dashboard");

  // Load application INCLUDING conversion fields
  const { data: app, error: appError } = await supabase
    .from("membership_applications")
    .select(
      "id, full_name, phone, email, requested_plan_code, requested_start_date, notes, status, converted_member_id"
    )
    .eq("id", applicationId)
    .single();

  if (appError || !app) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Convert Application</h1>
        <div className="rounded border p-3 text-sm">
          Could not load application.
          <div className="mt-1 text-xs opacity-70">{appError?.message}</div>
        </div>
        <Link className="underline underline-offset-2" href={backTo}>
          Back
        </Link>
      </div>
    );
  }

  // HARD GUARD (render): if already converted, never show convert form
  if (app.status === "converted" && app.converted_member_id) {
    redirect("/members/" + app.converted_member_id);
  }

  // Load plan by code
  const { data: plan, error: planError } = await supabase
    .from("membership_plans").select("id, name, code, price, duration_days").eq("is_active", true)
    .eq("code", app.requested_plan_code)
    .maybeSingle();

  if (planError || !plan) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Convert Application</h1>
        <div className="rounded border p-3 text-sm">
          Could not load membership plan for code:{" "}
          <span className="font-medium">{app.requested_plan_code}</span>
          <div className="mt-1 text-xs opacity-70">{planError?.message}</div>
        </div>
        <Link className="underline underline-offset-2" href={backTo}>
          Back
        </Link>
      </div>
    );
  }

  const startDate = app.requested_start_date || "";

  const defaultPaidOn = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Jamaica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  async function convertNow(formData: FormData) {
    "use server";

    const returnTo = safeReturnTo(String(formData.get("returnTo") || "/applications"));

    const applicationId = String(formData.get("application_id") || "").trim();
    const full_name = String(formData.get("full_name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim().toLowerCase();
    const start_date = String(formData.get("start_date") || "").trim();
    const plan_id = String(formData.get("plan_id") || "").trim();

    const amountRaw = String(formData.get("amount") || "").trim();
    const amount = Number(amountRaw);
    const payment_method = String(formData.get("payment_method") || "").trim();
    const paid_on = String(formData.get("paid_on") || "").trim();

    if (!applicationId) redirect(withParam(returnTo, "err", "Missing application id"));
    if (!full_name) redirect(withParam(returnTo, "err", "Missing name"));
    if (!email || !email.includes("@")) redirect(withParam(returnTo, "err", "Valid email required"));
    if (!start_date) redirect(withParam(returnTo, "err", "Start date required"));
    if (!plan_id) redirect(withParam(returnTo, "err", "Plan missing"));
    if (!paid_on) redirect(withParam(returnTo, "err", "Paid on date required"));
    if (!payment_method) redirect(withParam(returnTo, "err", "Payment method required"));
    if (!Number.isFinite(amount) || amount <= 0) redirect(withParam(returnTo, "err", "Amount must be > 0"));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: staffProfile } = await supabase
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!staffProfile) redirect("/auth/login");

    const role = staffProfile.role as Role;
    if (role !== "admin" && role !== "front_desk") redirect("/dashboard");

    // HARD GUARD (server): if already converted, STOP ALL WRITES
    const { data: existingApp } = await supabase
      .from("membership_applications")
      .select("status, converted_member_id, user_id")
      .eq("id", applicationId)
      .maybeSingle();

    if (existingApp?.status === "converted" && existingApp.converted_member_id) {
      redirect("/members/" + existingApp.converted_member_id);
    }
    // Load plan duration (server truth)
    const { data: plan, error: planError } = await supabase
      .from("membership_plans")
      .select("id, duration_days, price")
      .eq("id", plan_id)
      .maybeSingle();

    if (planError || !plan) redirect(withParam(returnTo, "err", "Could not load plan duration"));

    // IMPORTANT: set paid_through to start_date here.
    // Your payment logic/trigger should extend it ONCE.
    const initialPaidThrough = start_date;

    // 1) Create member
    const { data: member, error: memberErr } = await supabase
      .from("members")
      .insert({
        full_name,
        phone: phone || null,
        email,
        user_id: existingApp?.user_id ?? null,
        notes: null,
      })
      .select("id")
      .single();

    if (memberErr || !member) {
      await supabase.from("membership_applications").update({ status: "pending" }).eq("id", applicationId);
      redirect(withParam(returnTo, "err", "Member create failed: " + (memberErr?.message || "unknown")));
    }

    // 2) Create membership (do not pre-extend paid_through)
    const { data: membership, error: membershipErr } = await supabase
      .from("memberships")
      .insert({
        member_id: member.id,
        plan_id,
        start_date,
        paid_through_date: initialPaidThrough,
      })
      .select("id")
      .single();

    if (membershipErr || !membership) {
      await supabase.from("membership_applications").update({ status: "pending" }).eq("id", applicationId);
      redirect(withParam(returnTo, "err", "Membership create failed: " + (membershipErr?.message || "unknown")));
    }

    // 3) Create payment (linked to membership)
    const { error: payErr } = await supabase.from("payments").insert({
      membership_id: membership.id,
      amount,
      paid_on,
      payment_method,
    });

    if (payErr) {
      await supabase.from("membership_applications").update({ status: "pending" }).eq("id", applicationId);
      redirect(withParam(returnTo, "err", "Payment create failed: " + payErr.message));
    }

    // 4) Mark application converted
    const { error: appUpdateErr } = await supabase
      .from("membership_applications")
      .update({
        status: "converted",
        converted_member_id: member.id,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
      })
      .eq("id", applicationId);

    if (appUpdateErr) {
      redirect(withParam(returnTo, "err", "Application update failed: " + appUpdateErr.message));
    }

    redirect("/members/" + member.id + "?converted=1");
  }

  const returnTo = `/applications/${app.id}/convert?back=${backEncoded}`;

  const defaultPaidThrough = startDate ? addDays(startDate, Number(plan.duration_days || 0)) : "";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Convert Application</h1>
          <p className="text-sm opacity-70">Create Member + Membership + record payment</p>
        </div>
        <Link className="rounded border px-3 py-2 text-sm hover:bg-gray-50" href={backTo}>
          Back
        </Link>
      </div>

      {sp.err ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">Error: {sp.err}</div>
      ) : null}

      <form action={convertNow} className="space-y-3 rounded border p-4">
        <input type="hidden" name="application_id" value={app.id} />
        <input type="hidden" name="plan_id" value={plan.id} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <div className="space-y-1">
          <label className="text-sm font-medium">Full name</label>
          <input name="full_name" required defaultValue={app.full_name} className="w-full rounded border px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Email</label>
          <input name="email" type="email" required defaultValue={app.email || ""} className="w-full rounded border px-3 py-2" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Phone</label>
          <input name="phone" defaultValue={app.phone || ""} className="w-full rounded border px-3 py-2" />
        </div>

        <div className="rounded border p-3 text-sm">
          <div className="font-medium">Plan</div>
          <div className="mt-1 opacity-70">
            {plan.name || plan.code} • ${plan.price} • {plan.duration_days} days
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Start date</label>
          <input name="start_date" type="date" required defaultValue={startDate} className="w-full rounded border px-3 py-2" />
          <div className="text-xs opacity-60">
            Expected paid-through: <span className="font-medium">{defaultPaidThrough || "(select start date)"}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Amount</label>
            <input name="amount" inputMode="decimal" required defaultValue={String(plan.price)} className="w-full rounded border px-3 py-2" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Paid on</label>
            <input name="paid_on" type="date" required defaultValue={defaultPaidOn} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Payment method</label>
          <select name="payment_method" required className="w-full rounded border px-3 py-2" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>

        <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Convert + Record Payment
        </button>
      </form>
    </div>
  );
}
