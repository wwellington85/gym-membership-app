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
  const [showErr, setShowErr] = useState(Boolean(err));

  useEffect(() => setShowSaved(saved), [saved]);
  useEffect(() => setShowSent(sent), [sent]);
  useEffect(() => setShowErr(Boolean(err)), [err]);

  const cleanedHref = useMemo(() => {
    const p = new URLSearchParams(params.toString());
    p.delete("saved");
    p.delete("sent");
    p.delete("err");
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [params, pathname]);

  useEffect(() => {
    if (!saved && !sent && !err) return;

    const t = setTimeout(() => {
      setShowSaved(false);
      setShowSent(false);
      setShowErr(false);
      router.replace(cleanedHref, { scroll: false });
    }, 3000);

    return () => clearTimeout(t);
  }, [saved, sent, err, cleanedHref, router]);

  return (
    <div className="space-y-2">
      {showSaved ? (
        <div className="text-sm font-medium text-emerald-200">
          Saved.
        </div>
      ) : null}

      {showSent ? (
        <div className="text-sm font-medium text-emerald-200">
          Password reset email sent.
        </div>
      ) : null}

      {showErr && err ? (
        <div className="text-sm font-medium text-red-200">
          Error: {err}
        </div>
      ) : null}
    </div>
  );
}
