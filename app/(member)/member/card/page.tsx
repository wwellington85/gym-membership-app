import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/server";
import { computeMembershipStatus, type MembershipTier } from "@/lib/membership/status";

export const dynamic = "force-dynamic";

function fmtJamaicaDate(ts?: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { timeZone: "America/Jamaica" });
}

function normalizeTier(planCode?: string | null): MembershipTier {
  const code = String(planCode || "").toLowerCase();
  if (
    code === "rewards_free" ||
    code === "club_day" ||
    code === "club_weekly" ||
    code === "club_monthly_95"
  ) {
    return code as MembershipTier;
  }
  return "rewards_free";
}

export default async function MemberCardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: member } = await supabase
    .from("members")
    .select("id, full_name, phone, email")
    .eq("user_id", user.id)
    .maybeSingle();

  // Always show the page; if not linked yet, show a friendly empty state.
  if (!member) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Membership Card</h1>
            <p className="text-sm opacity-70">Travellers Club</p>
          </div>
          <Link href="/member" prefetch={false} className="rounded border px-3 py-2 text-sm hover:oura-surface-muted">
            Back
          </Link>
        </div>

        <div className="rounded border p-3 text-sm">
          We couldn’t find a membership profile linked to this login yet.
          <div className="mt-2 flex gap-2">
            <Link className="rounded border px-3 py-2 text-sm hover:oura-surface-muted" href="/join">
              Join Travellers Club
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("paid_through_date, membership_plans(code, name)")
    .eq("member_id", member.id)
    .maybeSingle();

  const planRaw: any = (membership as any)?.membership_plans;
  const plan: any = Array.isArray(planRaw) ? planRaw[0] : planRaw;

  const tier = normalizeTier(plan?.code);
  const computedStatus = computeMembershipStatus({
    tier,
    paid_through: (membership as any)?.paid_through_date ?? null,
  });

  const statusLabel =
    computedStatus === "active"
      ? "Active"
      : computedStatus === "pending"
      ? "Pending"
      : computedStatus === "expired"
      ? "Expired"
      : "Free";

  const statusHint =
    computedStatus === "active"
      ? "Enjoy full access."
      : computedStatus === "pending"
      ? "Payment needed to activate."
      : computedStatus === "expired"
      ? "Renew to regain access."
      : "Limited perks only.";

  const paidThroughLabel = fmtJamaicaDate((membership as any)?.paid_through_date ?? null);

  // QR payload: member id (simple and reliable for scanning)
  const payload = member.id;

  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Membership Card</h1>
          <p className="text-sm opacity-70">Show this at the gate / front desk</p>
        </div>
        <Link href="/member" prefetch={false} className="rounded border px-3 py-2 text-sm hover:oura-surface-muted">
          Back
        </Link>
      </div>

      <div className="oura-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm opacity-70">Name</div>
            <div className="text-lg font-semibold">{member.full_name}</div>
          </div>

          <span
            className={[
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
              computedStatus === "active"
                ? "bg-green-50"
                : computedStatus === "pending"
                ? "bg-yellow-50"
                : computedStatus === "expired"
                ? "bg-red-50"
                : "oura-surface-muted",
            ].join(" ")}
            title={statusHint}
          >
            {statusLabel}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="opacity-70">Plan</div>
            <div className="font-medium">{plan?.name ?? (tier === "rewards_free" ? "Free" : "—")}</div>
          </div>
          <div>
            <div className="opacity-70">Paid through</div>
            <div className="font-medium">{paidThroughLabel}</div>
          </div>
        </div>

        <div className="mt-3 text-xs opacity-70">{statusHint}</div>

        <div className="mt-4 text-sm opacity-70">Member ID</div>
        <div className="font-mono text-sm">{member.id}</div>

        <div className="mt-4 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="Member QR Code" className="h-56 w-56 rounded border" />
        </div>

        <div className="mt-3 text-center text-xs opacity-70">Staff: scan this QR to check you in.</div>
      </div>
    </div>
  );
}
