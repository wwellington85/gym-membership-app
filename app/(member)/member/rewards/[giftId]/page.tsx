import { RewardIcon } from "@/components/rewards/reward-icon";
import { RewardSeen } from "@/components/rewards/reward-seen";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireMember } from "@/lib/access/server";
import { giftStatus } from "@/lib/rewards/gifts";
import { membershipDate } from "@/lib/format/date";
import { RotatingQr } from "../../card/RotatingQr";
export const dynamic = "force-dynamic";
export default async function RewardPage({
  params,
}: {
  params: Promise<{ giftId: string }>;
}) {
  const { member, admin } = await requireMember();
  const { giftId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(giftId)) notFound();
  const { data: gift, error } = await admin
    .from("reward_gifts")
    .select("id, title, terms, valid_until, status, icon")
    .eq("id", giftId)
    .eq("member_id", member.id)
    .maybeSingle();
  if (error)
    throw new Error("Your reward could not be loaded. Please try again.");
  if (!gift) notFound();
  const status = giftStatus(gift);
  return (
    <div className="space-y-4">
      <RewardSeen giftId={gift.id} />
      <div className="flex items-center gap-3">
        <RewardIcon icon={gift.icon} className="h-9 w-9" />
        <h1 className="text-xl font-semibold">{gift.title}</h1>
      </div>
      <p>{gift.terms}</p>
      <p className="text-sm">
        Valid through {membershipDate(gift.valid_until)} at 10 pm
      </p>
      {member.is_active && status === "available" ? (
        <>
          <p className="text-sm">
            Show this reward QR to staff. They will verify your gift and confirm
            fulfilment. Opening this screen does not redeem it or spend points.
          </p>
          <RotatingQr giftId={gift.id} />
        </>
      ) : (
        <p role="status" className="oura-card p-4">
          {!member.is_active
            ? "Please contact the front desk about your membership."
            : `This reward is ${status}.`}
        </p>
      )}
      <Link href="/member/benefits#member-rewards" className="club-text-link">
        Back to rewards
      </Link>
    </div>
  );
}
