"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function FlashBanners() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const saved = params.get("saved") === "1";
  const sent = params.get("sent") === "1";
  const err = params.get("err");

  const [showSaved, setShowSaved] = useState(saved);
  const [showSent, setShowSent] = useState(sent);

  useEffect(() => setShowSaved(saved), [saved]);
  useEffect(() => setShowSent(sent), [sent]);

  const cleanedHref = useMemo(() => {
    const p = new URLSearchParams(params.toString());
    p.delete("saved");
    p.delete("sent");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [params, pathname]);

  useEffect(() => {
    if (!saved && !sent) return;

    const t = setTimeout(() => {
      setShowSaved(false);
      setShowSent(false);
      router.replace(cleanedHref, { scroll: false });
    }, 3000);

    return () => clearTimeout(t);
  }, [saved, sent, cleanedHref, router]);

  return (
    <div className="space-y-2">
      {showSaved ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          Saved.
        </div>
      ) : null}

      {showSent ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
          Password reset email sent.
        </div>
      ) : null}

      {err ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm">
          Error: {err}
        </div>
      ) : null}
    </div>
  );
}
