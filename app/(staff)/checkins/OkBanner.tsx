"use client";

import { useEffect, useState } from "react";

export function OkBanner({
  ok,
  ms = 2500,
}: {
  ok?: string;
  ms?: number;
}) {
  const [visible, setVisible] = useState(!!ok);

  useEffect(() => {
    if (!ok) return;

    // Clear the query param ASAP (no navigation)
    try {
      window.history.replaceState(null, "", "/checkins");
    } catch {}

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
    <div className="oura-card p-3 text-sm">
      <div className="font-medium">Success</div>
      <div className="mt-1 opacity-80">{message}</div>
    </div>
  );
}
