"use client";

import { useEffect } from "react";

export function AutoClearOk({
  enabled,
  href,
  ms = 2500,
}: {
  enabled: boolean;
  href: string;
  ms?: number;
}) {
  useEffect(() => {
    if (!enabled) return;

    const t = window.setTimeout(() => {
      // Always remove query params without triggering navigation
      window.history.replaceState(null, "", href);
    }, ms);

    return () => window.clearTimeout(t);
  }, [enabled, href, ms]);

  return null;
}
