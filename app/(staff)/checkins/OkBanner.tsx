"use client";

import { useEffect, useState } from "react";

export function OkBanner({ ok, ms = 2500 }: { ok?: string; ms?: number }) {
  const [visible, setVisible] = useState(Boolean(ok));

  useEffect(() => {
    if (!ok) return;

    // Clear query param immediately so URL becomes /checkins
    try {
      window.history.replaceState(null, "", "/checkins");
    } catch {}

    // Always hide after timeout
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), ms);
    return () => window.clearTimeout(t);
  }, [ok, ms]);

  if (!ok || !visible) return null;

  const message =
    ok === "already_checked_in"
      ? "Already checked in — this member was already checked in today."
      : ok === "checked_in"
      ? "Checked in — visit recorded successfully."
      : "Success.";

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <div className="font-medium">Success</div>
      <div className="mt-1 opacity-80">{message}</div>
    </div>
  );
}
