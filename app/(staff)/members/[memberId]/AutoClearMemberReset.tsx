"use client";

import { useEffect } from "react";

export function AutoClearMemberReset({
  enabled,
  href,
  ms = 3000,
}: {
  enabled: boolean;
  href: string;
  ms?: number;
}) {
  useEffect(() => {
    if (!enabled) return;

    const t = window.setTimeout(() => {
      window.history.replaceState(null, "", href);
    }, ms);

    return () => window.clearTimeout(t);
  }, [enabled, href, ms]);

  return null;
}
