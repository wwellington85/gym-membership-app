export type BrowserPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
export function validPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      (url.port && url.port !== "443")
    )
      return false;
    const h = url.hostname.toLowerCase();
    return (
      h === "web.push.apple.com" ||
      h.endsWith(".push.apple.com") ||
      h === "fcm.googleapis.com" ||
      h === "android.googleapis.com" ||
      h === "updates.push.services.mozilla.com" ||
      h.endsWith(".notify.windows.com")
    );
  } catch {
    return false;
  }
}
export function parsePushSubscription(
  value: unknown,
): BrowserPushSubscription | null {
  if (!value || typeof value !== "object") return null;
  const sub = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  if (
    !validPushEndpoint(sub.endpoint) ||
    typeof sub.keys?.p256dh !== "string" ||
    typeof sub.keys.auth !== "string"
  )
    return null;
  const key = (v: string, length: number) =>
    /^[A-Za-z0-9_-]+$/.test(v) && Buffer.from(v, "base64url").length === length;
  if (!key(sub.keys.p256dh, 65) || !key(sub.keys.auth, 16)) return null;
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  };
}
