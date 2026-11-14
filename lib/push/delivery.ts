import * as webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePushSubscription } from "./subscription";
import { giftStatus } from "@/lib/rewards/gifts";
export async function deliverRewardPush(
  admin: SupabaseClient,
  giftId: string | null = null,
) {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY,
    privateKey = process.env.WEB_PUSH_PRIVATE_KEY,
    subject = process.env.WEB_PUSH_SUBJECT;
  if (!publicKey || !privateKey || !subject)
    return { status: "not_configured" };
  const claim = await admin.rpc("claim_reward_push", { p_gift_id: giftId });
  if (claim.error || !claim.data)
    return { status: claim.error ? "unavailable" : "empty" };
  const id = String(claim.data);
  const finish = async (status: string, last_error: string | null = null) => {
    const { error } = await admin
      .from("reward_push_outbox")
      .update({
        status,
        last_error,
        updated_at: new Date().toISOString(),
        next_attempt_at: new Date(Date.now() + 600000).toISOString(),
      })
      .eq("gift_id", id);
    return { status: error ? "unavailable" : status };
  };
  try {
    const { data: gift, error } = await admin
      .from("reward_gifts")
      .select("id, member_id, status, valid_until, seen_at, members(is_active)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("lookup");
    const member =
      gift && (Array.isArray(gift.members) ? gift.members[0] : gift.members);
    if (
      !gift ||
      !member?.is_active ||
      gift.seen_at ||
      giftStatus(gift) !== "available"
    )
      return finish("skipped");
    const [subscriptions, outbox] = await Promise.all([
      admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("member_id", gift.member_id)
        .limit(10),
      admin
        .from("reward_push_outbox")
        .select("sent_subscription_ids, attempts")
        .eq("gift_id", id)
        .single(),
    ]);
    if (subscriptions.error || outbox.error) throw new Error("lookup");
    const sent = new Set<string>(outbox.data.sent_subscription_ids ?? []);
    const recipients = (subscriptions.data ?? []).filter(
      (s) => !sent.has(s.id),
    );
    const ttl = Math.max(
      1,
      Math.min(
        86400,
        Math.floor(
          (new Date(`${gift.valid_until}T22:00:00-05:00`).getTime() -
            Date.now()) /
            1000,
        ),
      ),
    );
    const payload = JSON.stringify({
      title: "A little thank-you from Travellers",
      body: "A new reward is waiting for you. Open the app to see your gift.",
      url: "/member/benefits#member-rewards",
      tag: `reward-${id}`,
    });
    const results = await Promise.all(
      recipients.map(async (s) => {
        const sub = parsePushSubscription({
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        });
        if (!sub) {
          const { error } = await admin
            .from("push_subscriptions")
            .delete()
            .eq("id", s.id);
          return !error;
        }
        try {
          await webpush.sendNotification(sub, payload, {
            vapidDetails: { subject, publicKey, privateKey },
            TTL: ttl,
            timeout: 4000,
          });
          const { error } = await admin.rpc("note_reward_push_delivery", {
            p_gift_id: id,
            p_subscription_id: s.id,
          });
          return !error;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            const { error } = await admin
              .from("push_subscriptions")
              .delete()
              .eq("id", s.id);
            return !error;
          }
          return false;
        }
      }),
    );
    if (results.some((ok) => !ok))
      return finish(
        outbox.data.attempts >= 4 ? "failed" : "pending",
        "delivery_failed",
      );
    return finish("sent");
  } catch {
    return finish("pending", "temporary_failure");
  }
}
