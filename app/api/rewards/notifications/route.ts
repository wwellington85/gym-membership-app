import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { giftStatus } from "@/lib/rewards/gifts";
import { jamaicaTodayYmd } from "@/lib/membership/status";
export const dynamic = "force-dynamic";
export async function GET() {
  const respond = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return respond({ items: [] }, 401);
  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .select("id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return respond({ error: "Notifications unavailable." }, 503);
  if (!member?.is_active) return respond({ items: [] });
  const { data, error: giftError } = await admin
    .from("reward_gifts")
    .select("id, title, icon, valid_until, status")
    .eq("member_id", member.id)
    .eq("status", "available")
    .is("seen_at", null)
    .gte("valid_until", jamaicaTodayYmd())
    .order("created_at", { ascending: false })
    .limit(50);
  if (giftError) return respond({ error: "Notifications unavailable." }, 503);
  return respond({
    items: (data ?? [])
      .filter((g) => giftStatus(g) === "available")
      .map((g) => ({ id: g.id, title: g.title, icon: g.icon })),
  });
}
