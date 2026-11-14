import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const respond = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (
    (request.headers.get("origin") &&
      request.headers.get("origin") !== new URL(request.url).origin) ||
    !request.headers.get("content-type")?.includes("application/json")
  )
    return respond({ ok: false }, 403);
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return respond({ ok: false }, 401);
  let giftId: unknown;
  try {
    giftId = (await request.json()).giftId;
  } catch {
    return respond({ ok: false }, 400);
  }
  if (typeof giftId !== "string" || !/^[0-9a-f-]{36}$/i.test(giftId))
    return respond({ ok: false }, 400);
  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !member) return respond({ ok: false }, 403);
  const { data, error: seenError } = await admin.rpc("mark_reward_seen", {
    p_member_id: member.id,
    p_gift_id: giftId,
  });
  return respond(
    { ok: !seenError && data === true },
    seenError ? 503 : data ? 200 : 404,
  );
}
