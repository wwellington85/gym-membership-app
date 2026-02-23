"use client";

import { useEffect } from "react";

export function AutoClearMemberReset({
  enabled,
  ms = 3000,
}: {
  enabled: boolean;
  ms?: number;
}) {
  useEffect(() => {
    if (!enabled) return;

    const t = window.setTimeout(() => {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("member_reset")) return;
      url.searchParams.delete("member_reset");
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState(null, "", next);
    }, ms);

    return () => window.clearTimeout(t);
  }, [enabled, ms]);

  return null;
}
