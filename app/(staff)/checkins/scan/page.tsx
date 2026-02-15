import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { verifyQrToken } from "@/lib/qr/token";
import { QrScanner } from "@/components/checkins/qr-scanner";

function parsePayload(raw: string): { memberId?: string; token?: string; err?: string } {
  const v = (raw || "").trim();
  if (!v) return { err: "Empty code" };

  // Accept URL payloads from scanner apps (e.g. https://.../?token=... or ?code=...)
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const qp =
        u.searchParams.get("token") ||
        u.searchParams.get("qr") ||
        u.searchParams.get("code") ||
        "";
      const inner = String(qp).trim();
      if (inner) return parsePayload(inner);
    } catch {
      // fall through
    }
  }

  // Expected formats:
  // 1) member:<uuid>
  // 2) qr:<token>
  // 3) <uuid>
  // 4) <token>  (payload.sig)
  if (v.startsWith("member:")) {
    const id = v.slice("member:".length).trim();
    return { memberId: id || undefined, err: id ? undefined : "Invalid member code" };
  }

  if (v.startsWith("qr:")) {
    const token = v.slice("qr:".length).trim();
    return { token: token || undefined, err: token ? undefined : "Invalid QR token" };
  }

  // If it looks like our signed token format (payload.sig), treat as token.
  if (v.split(".").length === 2 && v.length > 20) {
    return { token: v };
  }

  return { memberId: v };
}

async function resolveMemberIdFromParsed(parsed: { memberId?: string; token?: string; err?: string }) {
  if (parsed.err) return { ok: false as const, err: parsed.err };
  if (parsed.memberId) return { ok: true as const, memberId: parsed.memberId };

  const token = String(parsed.token || "").trim();
  if (!token) return { ok: false as const, err: "Invalid code" };

  const secret = process.env.QR_TOKEN_SECRET || "";
  if (!secret) return { ok: false as const, err: "Missing QR_TOKEN_SECRET" };

  const v = verifyQrToken(token, secret);
  if (!v.ok) return { ok: false as const, err: `QR token ${v.reason}` };

  return { ok: true as const, memberId: v.claims.mid };
}


function pct(n?: number | null) {
  const v = typeof n === "number" ? n : 0;
  return `${Math.round(v * 100)}%`;
}

export default async function ScanCheckinPage({
  searchParams,
}: {
  searchParams?: Promise<{ code?: string; ok?: string; err?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const code = sp.code ?? "";
  const ok = sp.ok ?? "";
  const errMsg = sp.err ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?returnTo=/checkins/scan");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login?returnTo=/checkins/scan");

  const canCheckin = ["admin", "front_desk", "security"].includes(staffProfile.role);

  if (!canCheckin) redirect("/dashboard?err=Not%20authorized");

  async function lookup(formData: FormData) {
    "use server";
    const raw = String(formData.get("code") || "").trim();
    redirect(`/checkins/scan?code=${encodeURIComponent(raw)}`);
  }

  async function checkin(formData: FormData) {
    "use server";

    const raw = String(formData.get("code") || "").trim();
        const parsed = parsePayload(raw);
    const resolved = await resolveMemberIdFromParsed(parsed);
    if (!resolved.ok) {
      redirect(`/checkins/scan?code=${encodeURIComponent(raw)}&err=${encodeURIComponent(resolved.err)}`);
    }
    const memberId = resolved.memberId;


    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login?returnTo=/checkins/scan");

    // Load member + membership + plan benefits
    const { data: membership } = await supabase
      .from("memberships")
      .select(
        "id, member_id, status, membership_plans(name, plan_type, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa)"
      )
      .eq("member_id", memberId)
      .maybeSingle();

    const plan = Array.isArray((membership as any)?.membership_plans)
      ? (membership as any).membership_plans[0]
      : (membership as any)?.membership_plans;

    const accessAllowed = membership?.status === "active" && !!plan?.grants_access;

    if (!accessAllowed) {
      redirect(`/checkins/scan?code=${encodeURIComponent(raw)}&err=${encodeURIComponent("Access not allowed (inactive or rewards-only).")}`);
    }

    // Points per check-in
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("int_value")
      .eq("key", "points_per_checkin")
      .maybeSingle();

    const pointsEarned = settingRow?.int_value ?? 1;

    const { error } = await supabase.from("checkins").insert({
      member_id: memberId,
      staff_user_id: user.id,
      points_earned: pointsEarned,
    });

    if (error) {
      if ((error as any).code === "23505") {
        redirect(`/checkins/scan?code=${encodeURIComponent(raw)}&err=${encodeURIComponent("Already checked in today.")}`);
      }
      redirect(`/checkins/scan?code=${encodeURIComponent(raw)}&err=${encodeURIComponent(error.message)}`);
    }

    redirect(`/checkins/scan?code=${encodeURIComponent(raw)}&ok=checked_in`);
  }

  let member: any = null;
  let membership: any = null;
  let plan: any = null;
  if (code) {
    const parsed = parsePayload(code);
    const resolved = await resolveMemberIdFromParsed(parsed);
    if (resolved.ok) {
      const mid = resolved.memberId;

      const { data: m } = await supabase
        .from("members")
        .select("id, full_name, phone, email")
        .eq("id", mid)
        .maybeSingle();

      member = m;

      const { data: ms } = await supabase
        .from("memberships")
        .select(
          "id, member_id, status, paid_through_date, membership_plans(name, plan_type, grants_access, discount_food, discount_watersports, discount_giftshop, discount_spa)"
        )
        .eq("member_id", mid)
        .maybeSingle();

      membership = ms;
      plan = Array.isArray((ms as any)?.membership_plans)
        ? (ms as any).membership_plans[0]
        : (ms as any)?.membership_plans;
    }
  }

  const accessAllowed = membership?.status === "active" && !!plan?.grants_access;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Scan Check-in</h1>
          <p className="text-sm opacity-70">Paste the QR code value to look up a member.</p>
        </div>
        <Link href="/checkins" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          Back
        </Link>
      </div>

      {ok === "checked_in" ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-medium">Checked in</div>
          <div className="mt-1 opacity-80">Visit recorded successfully.</div>
        </div>
      ) : null}

      {errMsg ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="font-medium">Notice</div>
          <div className="mt-1 opacity-80">{errMsg}</div>
        </div>
      ) : null}
      <QrScanner />
<form action={lookup} className="space-y-2">
        <label className="text-sm font-medium">QR / Code</label>
        <input
          name="code"
          defaultValue={code}
          placeholder="e.g., member:uuid…"
          className="w-full rounded border px-3 py-2 font-mono text-sm"
        />
        <button type="submit" className="w-full rounded border px-3 py-2 hover:bg-gray-50">
          Look up
        </button>
      </form>

      {code && !member ? (
        <div className="rounded border p-3 text-sm opacity-70">No member found for that code.</div>
      ) : null}

      {member ? (
        <div className="rounded border p-3 space-y-2">
          <div className="font-medium">{member.full_name}</div>
          <div className="text-sm opacity-70">{member.phone ?? member.id}</div>

          <div className="oura-card p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Access</div>
              <div className="text-sm font-semibold">{accessAllowed ? "Allowed" : "Not allowed"}</div>
            </div>
            <div className="mt-2 text-xs opacity-70">
              Plan: {plan?.name ?? "—"} • Type: {plan?.plan_type ?? "—"} • Status: {membership?.status ?? "—"}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Food</div>
                <div className="font-medium">{pct(plan?.discount_food)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Watersports</div>
                <div className="font-medium">{pct(plan?.discount_watersports)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Gift Shop</div>
                <div className="font-medium">{pct(plan?.discount_giftshop)}</div>
              </div>
              <div className="rounded border p-2">
                <div className="text-xs opacity-70">Spa</div>
                <div className="font-medium">{pct(plan?.discount_spa)}</div>
              </div>
            </div>

            <form action={checkin} className="mt-3">
              <input type="hidden" name="code" value={code} />
              <button
                type="submit"
                className="w-full rounded border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
                disabled={String(membership?.status || "").toLowerCase() !== "active"}
              >
                Record check-in
              </button>
            </form>

            {!accessAllowed ? (
              <div className="mt-2 text-xs opacity-70">
                Rewards member — NO GYM/POOL access. Discounts may apply (e.g., restaurant). Still record check-in for loyalty points.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
