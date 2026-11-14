import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { giftStatus } from "@/lib/rewards/gifts";
import { signRewardToken } from "@/lib/rewards/token";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const respond = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return respond({ error: "Sign in to view your reward." }, 401);
  const giftId = new URL(request.url).searchParams.get("gift");
  if (!giftId || !/^[0-9a-f-]{36}$/i.test(giftId))
    return respond({ error: "Reward unavailable." }, 400);
  const admin = createAdminClient();
  const { data: member, error: memberError } = await admin
    .from("members")
    .select("id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError) return respond({ error: "Please try again." }, 503);
  if (!member?.is_active)
    return respond({ error: "Please contact the front desk." }, 403);
  const { data: gift, error } = await admin
    .from("reward_gifts")
    .select("id, status, valid_until")
    .eq("id", giftId)
    .eq("member_id", member.id)
    .maybeSingle();
  if (error) return respond({ error: "Please try again." }, 503);
  if (!gift || giftStatus(gift) !== "available")
    return respond({ error: "This reward is no longer available." }, 410);
  const secret = process.env.QR_TOKEN_SECRET;
  if (!secret)
    return respond(
      { error: "Reward verification is temporarily unavailable." },
      503,
    );
  return respond(signRewardToken(member.id, gift.id, secret));
}
