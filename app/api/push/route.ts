import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  parsePushSubscription,
  validPushEndpoint,
} from "@/lib/push/subscription";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function context() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: member, error } = await admin
    .from("members")
    .select("id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !member) return null;
  return { member, admin };
}
function sameOrigin(req: Request) {
  return (
    req.headers.get("origin") === new URL(req.url).origin &&
    req.headers.get("content-type")?.includes("application/json")
  );
}
export async function GET(req: Request) {
  const ctx = await context();
  if (!ctx) return respond({ error: "Sign in to manage notifications." }, 401);
  const endpoint = req.headers.get("x-push-endpoint");
  let registered = false;
  if (endpoint && validPushEndpoint(endpoint)) {
    const { data, error } = await ctx.admin
      .from("push_subscriptions")
      .select("id")
      .eq("member_id", ctx.member.id)
      .eq("endpoint", endpoint)
      .maybeSingle();
    if (error)
      return respond({ error: "Notification settings unavailable." }, 503);
    registered = !!data;
  }
  return respond({
    publicKey: process.env.WEB_PUSH_PUBLIC_KEY || null,
    configured: !!(
      process.env.WEB_PUSH_PUBLIC_KEY &&
      process.env.WEB_PUSH_PRIVATE_KEY &&
      process.env.WEB_PUSH_SUBJECT
    ),
    registered,
    active: ctx.member.is_active,
  });
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return respond({ error: "Request not allowed." }, 403);
  const ctx = await context();
  if (!ctx) return respond({ error: "Sign in to manage notifications." }, 401);
  if (!ctx.member.is_active)
    return respond({ error: "Please contact the front desk." }, 403);
  if (!process.env.WEB_PUSH_PUBLIC_KEY || !process.env.WEB_PUSH_PRIVATE_KEY)
    return respond({ error: "Push alerts are temporarily unavailable." }, 503);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid subscription." }, 400);
  }
  const sub = parsePushSubscription(body);
  if (!sub)
    return respond({ error: "This push service is not supported." }, 400);
  const { data, error } = await ctx.admin.rpc("register_member_push", {
    p_member_id: ctx.member.id,
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
  });
  const response = respond(
    error
      ? { error: "Could not save notification settings. Please retry." }
      : { ok: true },
    error ? 503 : 200,
  );
  if (!error && typeof data === "string")
    response.cookies.set("club_push_device", data, {
      httpOnly: true,
      secure: new URL(req.url).protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: 31536000,
    });
  return response;
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return respond({ error: "Request not allowed." }, 403);
  const ctx = await context();
  if (!ctx) return respond({ error: "Sign in to manage notifications." }, 401);
  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return respond({ error: "Invalid request." }, 400);
  }
  if (!body || typeof body !== "object" || !validPushEndpoint(body.endpoint))
    return respond({ error: "Invalid endpoint." }, 400);
  const { error } = await ctx.admin
    .from("push_subscriptions")
    .delete()
    .eq("member_id", ctx.member.id)
    .eq("endpoint", body.endpoint);
  return respond(
    error ? { error: "Could not disable alerts. Please retry." } : { ok: true },
    error ? 503 : 200,
  );
}
