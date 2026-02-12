import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(v: any) {
  const n = Number(v ?? 0);
  return n.toFixed(2);
}

export default async function UpgradePage(props: { searchParams: Promise<{ plan?: string; err?: string }> }) {
  const searchParams = await props.searchParams;
  const selectedCode = String(searchParams?.plan || "").trim();
  const errMsg = String(searchParams?.err || "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) redirect("/join");

  if (!selectedCode) {
    redirect("/member/settings?err=Missing%20plan");
  }

  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id, code, name, price, duration_days, is_active")
    .eq("is_active", true)
    .eq("code", selectedCode)
    .maybeSingle();

  if (!plan || plan.code === "rewards_free") {
    redirect("/member/settings?err=Invalid%20plan");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Confirm plan</h1>
          <p className="text-sm opacity-70">You’re upgrading to full access.</p>
        </div>
        <Link href="/member/settings" className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:oura-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 group">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 opacity-80 transition-opacity group-hover:opacity-100"><path fill="currentColor" d="M15.5 19.5a1 1 0 0 1-.7-.3l-7-7a1 1 0 0 1 0-1.4l7-7a1 1 0 1 1 1.4 1.4L10.9 12l5.3 5.3a1 1 0 0 1-.7 1.7z"/></svg><span className="sr-only">Back</span>
        </Link>
      </div>

      {errMsg ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
          <div className="font-medium">Payment error</div>
          <div className="opacity-80">{errMsg}</div>
        </div>
      ) : null}

      <div className="oura-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium">{plan.name}</div>
            <div className="text-sm opacity-70">
              {plan.duration_days} day{plan.duration_days === 1 ? "" : "s"} • ${money(plan.price)}
            </div>
          </div>

          <form action="/api/fygaro/checkout" method="POST">
            <input type="hidden" name="plan" value={plan.code} />
            <button type="submit" className="rounded border px-3 py-2 text-sm hover:oura-surface-muted">
              Continue to payment
            </button>
          </form>
        </div>
      </div>

      <div className="rounded border oura-surface-muted p-3 text-sm">
        After payment, your membership activates automatically.
      </div>
    </div>
  );
}
