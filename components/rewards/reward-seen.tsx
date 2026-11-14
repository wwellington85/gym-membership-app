"use client";
import { useEffect } from "react";
export function RewardSeen({ giftId }: { giftId: string }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/rewards/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giftId }),
      signal: controller.signal,
    })
      .then((res) => {
        if (res.ok)
          window.dispatchEvent(
            new CustomEvent("club-rewards-read", { detail: giftId }),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, [giftId]);
  return null;
}
