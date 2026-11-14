import { redirect } from "next/navigation";
import Link from "next/link";
import { requireRewardPermission } from "@/lib/rewards/permissions";
import { RewardIcon } from "@/components/rewards/reward-icon";
import { QrScanner } from "@/components/checkins/qr-scanner";
import { verifyRewardToken } from "@/lib/rewards/token";
import { giftStatus } from "@/lib/rewards/gifts";
import { membershipDate } from "@/lib/format/date";
export const dynamic = "force-dynamic";
export default async function RedeemReward({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; err?: string; ok?: string }>;
}) {
  const { admin } = await requireRewardPermission("can_redeem");
  const sp = await searchParams;
  async function lookup(form: FormData) {
    "use server";
    await requireRewardPermission("can_redeem");
    redirect(
      `/rewards/redeem?code=${encodeURIComponent(String(form.get("code") || "").slice(0, 1000))}`,
    );
  }
  async function redeem(form: FormData) {
    "use server";
    const { admin, user } = await requireRewardPermission("can_redeem");
    const claims = process.env.QR_TOKEN_SECRET
      ? verifyRewardToken(
          String(form.get("code") || ""),
          process.env.QR_TOKEN_SECRET,
        )
      : null;
    if (!claims)
      redirect(
        "/rewards/redeem?err=QR%20expired%20or%20invalid.%20Ask%20the%20member%20to%20refresh%20it.",
      );
    const { data, error } = await admin.rpc("redeem_reward_gift", {
      p_gift_id: claims.giftId,
      p_member_id: claims.memberId,
      p_staff_id: user.id,
    });
    redirect(
      `/rewards/redeem?${error ? "err=Reward%20could%20not%20be%20redeemed.%20Check%20its%20status." : `ok=${data ? "redeemed" : "already"}`}`,
    );
  }
  const claims =
    sp.code && process.env.QR_TOKEN_SECRET
      ? verifyRewardToken(sp.code, process.env.QR_TOKEN_SECRET)
      : null;
  const { data: gift, error } = claims
    ? await admin
        .from("reward_gifts")
        .select(
          "id, member_id, title, terms, valid_until, status, redeemed_at, icon, members(full_name, member_number, is_active)",
        )
        .eq("id", claims.giftId)
        .eq("member_id", claims.memberId)
        .maybeSingle()
    : { data: null, error: null };
  const member = gift
    ? ((Array.isArray(gift.members) ? gift.members[0] : gift.members) as {
        full_name: string;
        member_number: string;
        is_active: boolean;
      } | null)
    : null;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Redeem a reward</h1>
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      {sp.ok && (
        <p role="status" className="oura-alert-success">
          {sp.ok === "redeemed"
            ? "Reward redeemed. Fulfil this gift once; no visit or points were added or deducted."
            : "This reward has already been redeemed. Do not fulfil it again."}
        </p>
      )}
      <QrScanner lookup={lookup} reward />
      <form action={lookup} className="space-y-2">
        <label htmlFor="reward-code">Reward QR value</label>
        <input
          id="reward-code"
          name="code"
          required
          maxLength={1000}
          className="oura-input w-full p-3"
        />
        <button className="club-button-secondary">Check reward</button>
      </form>
      {sp.code && !gift && (
        <p role="alert">
          {error
            ? "Reward lookup is temporarily unavailable."
            : "QR invalid, expired or reward unavailable. Ask the member to refresh their reward screen."}
        </p>
      )}
      {gift && (
        <section className="oura-card space-y-3 p-4">
          <div className="flex items-center gap-3">
            <RewardIcon icon={gift.icon} />
            <h2 className="font-semibold">{gift.title}</h2>
          </div>
          <p>
            {member?.full_name} · {member?.member_number}
          </p>
          <p>{gift.terms}</p>
          <p>
            Valid through {membershipDate(gift.valid_until)} at 10 pm ·{" "}
            {giftStatus(gift)}
          </p>
          {member?.is_active && giftStatus(gift) === "available" ? (
            <form action={redeem}>
              <input type="hidden" name="code" value={sp.code} />
              <p className="mb-3 text-sm">
                Verify the member and item availability. Confirm only when you
                can fulfil the gift.
              </p>
              <button className="club-button">Confirm fulfilment</button>
            </form>
          ) : (
            <p role="alert">
              This reward cannot be fulfilled. Check member and reward status.
            </p>
          )}
          <Link href={`/members/${gift.member_id}`} className="club-text-link">
            Member record
          </Link>
        </section>
      )}
    </div>
  );
}
