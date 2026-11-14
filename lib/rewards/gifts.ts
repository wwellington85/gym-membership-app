import { jamaicaNowParts } from "@/lib/membership/status";
export type RewardGift = {
  id: string;
  member_id: string;
  title: string;
  terms: string;
  valid_until: string;
  status: string;
  created_at: string;
  redeemed_at?: string | null;
};
export function giftStatus(
  gift: Pick<RewardGift, "status" | "valid_until">,
  now = new Date(),
) {
  if (gift.status !== "available") return gift.status;
  const local = jamaicaNowParts(now);
  return gift.valid_until < local.ymd ||
    (gift.valid_until === local.ymd && local.hour >= 22)
    ? "expired"
    : "available";
}
