"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AutoClearOk({
  enabled,
  href,
  ms = 2500,
}: {
  enabled: boolean;
  href: string;
  ms?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => {
      router.replace(href);
    }, ms);
    return () => clearTimeout(t);
  }, [enabled, href, ms, router]);

  return null;
}
