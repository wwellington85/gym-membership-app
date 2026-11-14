import type { SupabaseClient } from "@supabase/supabase-js";
import type { RewardGift } from "./gifts";
// Callers pass only the authenticated member ID or a staff-verified record ID.
export async function loadMemberGifts(admin: SupabaseClient, memberId: string) {
  const { data, error } = await admin
    .from("reward_gifts")
    .select(
      "id, member_id, title, terms, valid_until, status, created_at, redeemed_at",
    )
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(50);
  return { gifts: (data ?? []) as RewardGift[], error: !!error };
}
