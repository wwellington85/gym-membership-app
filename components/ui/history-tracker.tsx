"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const KEY_PREV = "tbr_prev_path";
const KEY_CURR = "tbr_curr_path";

function fullPath(pathname: string, searchParams: URLSearchParams | null) {
  const qs = searchParams?.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function HistoryTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const next = fullPath(pathname, searchParams);
    const curr = sessionStorage.getItem(KEY_CURR);

    // Only update if the route truly changed
    if (curr && curr !== next) {
      sessionStorage.setItem(KEY_PREV, curr);
    }

    sessionStorage.setItem(KEY_CURR, next);
  }, [pathname, searchParams]);

  return null;
}
