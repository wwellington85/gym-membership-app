"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinSuccessBanner() {
  const router = useRouter();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setVisible(false), 4500);
    const clearParamTimer = setTimeout(() => {
      router.replace("/join", { scroll: false });
    }, 5000);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearParamTimer);
    };
  }, [router]);

  if (!visible) return null;

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      Thanks. Your membership request was received.
    </div>
  );
}
