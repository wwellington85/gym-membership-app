"use client";
import { useEffect, useState } from "react";
export function PushSettings() {
  const [supported, setSupported] = useState<boolean | null>(null),
    [installedRequired, setInstalledRequired] = useState(false),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [key, setKey] = useState<string | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone;
    if (ios && !standalone) {
      setInstalledRequired(true);
      setSupported(false);
      return;
    }
    const available =
      "Notification" in window &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    setSupported(available);
    if (!available) return;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        const res = await fetch("/api/push", {
          cache: "no-store",
          headers: sub ? { "X-Push-Endpoint": sub.endpoint } : undefined,
        });
        const data = await res.json();
        if (disposed) return;
        if (!res.ok) throw Error(data.error || "Settings unavailable.");
        setKey(data.publicKey);
        setReady(data.configured === true && data.active === true);
        setEnabled(
          data.registered === true && Notification.permission === "granted",
        );
        if (!data.configured)
          setMessage(
            "Push alerts are temporarily unavailable. Your in-app rewards are still here.",
          );
      } catch {
        if (!disposed)
          setMessage(
            "Notification settings could not be loaded. Please reopen Account to retry.",
          );
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);
  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      // Ask directly from the button gesture, before registration/network awaits.
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          permission === "denied"
            ? "Notifications are blocked. You can allow them in this app’s notification settings."
            : "Notifications remain off. You can enable them whenever you like.",
        );
        return;
      }
      if (!key) throw Error("Push alerts are temporarily unavailable.");
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;
      const raw = key.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = atob(raw + "=".repeat((4 - (raw.length % 4)) % 4));
      const applicationServerKey = Uint8Array.from(decoded, (c) =>
        c.charCodeAt(0),
      );
      const subscription =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) {
        const data = await res.json();
        throw Error(data.error || "Could not enable notifications.");
      }
      setEnabled(true);
      setMessage("Reward alerts are enabled on this device.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not enable notifications. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const res = await fetch("/api/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (!res.ok) throw Error("Could not turn off alerts. Please retry.");
        await sub.unsubscribe();
      }
      setEnabled(false);
      setMessage("Reward alerts are off on this device.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="notifications" className="oura-card space-y-3 p-4">
      <h2 className="font-semibold">Reward notifications</h2>
      <p className="text-sm text-muted-foreground">
        Choose whether this device receives an alert when the Travellers team
        sends you a reward, even when the app is closed.
      </p>
      {supported === null ? (
        <p className="text-sm">Checking notification support…</p>
      ) : installedRequired ? (
        <p className="text-sm">
          On iPhone or iPad, add Travellers Club to your Home Screen and open it
          there to enable push alerts.
        </p>
      ) : !supported ? (
        <p className="text-sm">
          Push alerts are not supported in this browser. Your in-app rewards
          remain available.
        </p>
      ) : (
        <button
          type="button"
          disabled={busy || (!enabled && !ready)}
          onClick={enabled ? disable : enable}
          className="club-button-secondary disabled:opacity-50"
        >
          {busy
            ? "Updating…"
            : enabled
              ? "Turn off push alerts"
              : "Enable push notifications"}
        </button>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
