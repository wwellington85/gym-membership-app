import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { purchasePeriod, type AccessPass } from "@/lib/access/rules";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return new NextResponse("Invalid origin", { status: 403 });
  const fd = await req.formData();
  const planCode = String(fd.get("plan") || "");
  const fail = (message: string) => {
    const url = new URL("/member/upgrade", req.url);
    url.searchParams.set("plan", planCode);
    url.searchParams.set("err", message);
    return NextResponse.redirect(url, 303);
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.redirect(
      new URL("/auth/login?returnTo=/member/access", req.url),
      303,
    );
  const admin = createAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member?.is_active)
    return fail("Your membership needs front desk assistance.");
  if (
    !process.env.FYGARO_BUTTON_URL ||
    !process.env.FYGARO_API_KEY ||
    !process.env.FYGARO_API_SECRET
  )
    return fail(
      "Online payment is temporarily unavailable. Please contact the front desk.",
    );
  const key = String(fd.get("checkout_key") || "");
  if (!/^[0-9a-f-]{36}$/i.test(key))
    return fail("Please reload the confirmation page and try again.");
  const { data: prior } = await admin
    .from("payments")
    .select("id")
    .eq("member_id", member.id)
    .eq("checkout_key", key)
    .maybeSingle();
  if (prior)
    return NextResponse.redirect(
      new URL(`/member/checkout?payment=${prior.id}`, req.url),
      303,
    );
  const { data: plan } = await admin
    .from("membership_plans")
    .select(
      "id, code, name, price, duration_days, grants_access, access_scope, discount_food, discount_spa, discount_giftshop, discount_watersports",
    )
    .eq("code", planCode)
    .eq("visible_on_join", true)
    .eq("is_active", true)
    .maybeSingle();
  if (!plan?.grants_access || Number(plan.price) <= 0)
    return fail("Select an available access product.");
  if (String(fd.get("quote")) !== JSON.stringify(plan))
    return fail(
      "This product has changed. Review the current details before continuing.",
    );
  if (fd.get("waiver") !== "on")
    return fail("Please accept the facility waiver before buying access.");
  const { data: membership } = await admin
    .from("memberships")
    .select("id")
    .eq("member_id", member.id)
    .maybeSingle();
  if (!membership)
    return fail("Please ask the front desk to finish setting up your account.");
  const { data: passes, error: passError } = await admin
    .from("access_passes")
    .select("*")
    .eq("member_id", member.id)
    .eq("plan_id", plan.id)
    .eq("status", "active")
    .order("paid_through_date", { ascending: false })
    .limit(1);
  if (passError)
    return fail("We could not verify existing access. Please try again.");
  let period;
  try {
    period = purchasePeriod({
      start: String(fd.get("start_date") || ""),
      duration: Number(plan.duration_days),
      renew: fd.get("intent") === "renew",
      current: (passes?.[0] as AccessPass) ?? null,
      planId: plan.id,
    });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Check your start date.",
    );
  }
  const { data: extraBenefits, error: benefitsError } = await admin
    .from("membership_plan_benefits")
    .select("label, value")
    .eq("plan_id", plan.id)
    .eq("is_active", true)
    .order("sort_order");
  if (benefitsError)
    return fail(
      "We could not verify current product benefits. Please try again.",
    );
  const { data: payment, error } = await admin
    .from("payments")
    .insert({
      membership_id: membership.id,
      member_id: member.id,
      amount: plan.price,
      currency: "USD",
      provider: "fygaro",
      status: "pending",
      provider_reference: plan.code,
      purchased_plan_id: plan.id,
      purchase_snapshot: { ...plan, benefits: extraBenefits ?? [] },
      access_start_date: period.start,
      access_end_date: period.end,
      checkout_key: key,
      waiver_accepted_at: new Date().toISOString(),
      waiver_version: "facilities-2026-11-12",
      notes: `Access purchase: ${plan.name}`,
    })
    .select("id")
    .single();
  if (error || !payment) {
    if (error?.code === "23505") {
      const { data: existing } = await admin
        .from("payments")
        .select("id")
        .eq("member_id", member.id)
        .eq("checkout_key", key)
        .maybeSingle();
      if (existing)
        return NextResponse.redirect(
          new URL(`/member/checkout?payment=${existing.id}`, req.url),
          303,
        );
    }
    return fail("We could not start checkout. Please try again.");
  }
  return NextResponse.redirect(
    new URL(`/member/checkout?payment=${payment.id}`, req.url),
    303,
  );
}
