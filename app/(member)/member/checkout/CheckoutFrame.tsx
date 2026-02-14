"use client";

import { useEffect, useState } from "react";

function isIOSUserAgent(ua: string) {
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOS = /Macintosh/i.test(ua) && /Mobile/i.test(ua);
  return isAppleMobile || isIPadOS;
}

export function CheckoutFrame({ url }: { url: string }) {
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(isIOSUserAgent(navigator.userAgent || ""));
  }, []);

  // iOS: prefer new tab. Others: same-tab is fine.
  const target = isIOS ? "_blank" : "_self";

  return (
    <div className="oura-card p-4 space-y-3">
      <div className="text-sm opacity-70">
        You’ll be taken to our secure payment page to complete checkout.
      </div>

      <a
        href={url}
        target={target}
        rel={isIOS ? "noopener noreferrer" : undefined}
        className="block w-full rounded border px-3 py-3 text-center text-sm hover:oura-surface-muted"
      >
        Continue to secure payment
      </a>

      <div className="text-xs opacity-70">
        After payment, you’ll return to this app automatically.
      </div>
    </div>
  );
}
