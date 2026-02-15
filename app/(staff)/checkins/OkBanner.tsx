"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = { ok?: string };

function messageFor(ok: string) {
  switch (ok) {
    case "checked_in":
      return { title: "Checked in", body: "Visit recorded successfully." };
    case "already_checked_in":
      return { title: "Already checked in", body: "This member was already checked in today." };
    default:
      return { title: "Success", body: "Done." };
  }
}

export function OkBanner({ ok }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const effectiveOk = ok || sp.get("ok") || "";
  const [open, setOpen] = useState(Boolean(effectiveOk));

  const msg = useMemo(() => (effectiveOk ? messageFor(effectiveOk) : null), [effectiveOk]);

  useEffect(() => {
    if (!effectiveOk) return;

    setOpen(true);

    const t = setTimeout(() => {
      // Remove ok=... from URL without a full reload
      const params = new URLSearchParams(Array.from(sp.entries()));
      params.delete("ok");
      const q = params.toString();
      router.replace(q ? `/checkins?${q}` : "/checkins");
      setOpen(false);
    }, 2000);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOk]);

  if (!effectiveOk || !open || !msg) return null;

  return (
    <div className="oura-card p-3 text-sm text-foreground border" >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{msg.title}</div>
          <div className="mt-1 text-foreground/70">{msg.body}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            router.replace("/checkins");
          }}
          className="rounded border px-2 py-1 text-xs hover:oura-surface-muted text-foreground"
        >
          Close
        </button>
      </div>
    </div>
  );
}
