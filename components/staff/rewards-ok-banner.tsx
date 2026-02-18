"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function RewardsOkBanner({ clearHref }: { clearHref: string }) {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setVisible(false), 2600);
    const clearTimer = setTimeout(() => {
      router.replace(clearHref, { scroll: false });
    }, 3000);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
    };
  }, [router, clearHref]);

  if (!visible) return null;

  return (
    <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
      Saved.
    </div>
  );
}
