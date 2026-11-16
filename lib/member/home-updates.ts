import type { SupabaseClient } from "@supabase/supabase-js";
import { jamaicaNowParts, addDaysYmd } from "@/lib/membership/status";

export type HomeBooking = {
  id: string;
  product_code: string;
  booking_date: string;
  start_minute: number;
};
export type HomeReward = {
  id: string;
  title: string;
  icon: string;
  valid_until: string;
};
export async function loadHomeUpdates(
  admin: SupabaseClient,
  memberId: string,
  now = new Date(),
) {
  const { ymd, hour } = jamaicaNowParts(now);
  const minutePart = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Jamaica",
    minute: "2-digit",
  }).format(now);
  const minute = hour * 60 + Number(minutePart);
  const results = await Promise.allSettled([
    admin
      .from("experience_bookings")
      .select("id,product_code,booking_date,start_minute")
      .eq("member_id", memberId)
      .eq("status", "confirmed")
      .gte("booking_date", ymd)
      .or(
        `booking_date.gt.${ymd},and(booking_date.eq.${ymd},start_minute.gt.${minute})`,
      )
      .order("booking_date")
      .order("start_minute")
      .limit(1)
      .maybeSingle(),
    admin
      .from("reward_gifts")
      .select("id,title,icon,valid_until")
      .eq("member_id", memberId)
      .eq("status", "available")
      .gte("valid_until", hour >= 22 ? addDaysYmd(ymd, 1) : ymd)
      .order("valid_until")
      .limit(1)
      .maybeSingle(),
  ]);
  const booking =
    results[0].status === "fulfilled"
      ? results[0].value
      : { data: null, error: true };
  const reward =
    results[1].status === "fulfilled"
      ? results[1].value
      : { data: null, error: true };
  return {
    booking: booking.error ? null : (booking.data as HomeBooking | null),
    reward: reward.error ? null : (reward.data as HomeReward | null),
    error: !!booking.error || !!reward.error,
  };
}
