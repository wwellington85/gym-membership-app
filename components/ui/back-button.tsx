"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({
  fallbackHref = "/member",
  className = "",
}: {
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function goBack() {
    // If a returnTo is present, prefer that.
    const returnTo = sp.get("returnTo");
    if (returnTo) {
      router.replace(returnTo);
      return;
    }

    // Try history back first. If the page was opened directly, fallback.
    router.back();

    // Fallback after a tick (prevents getting stuck on pages with no history)
    setTimeout(() => {
      // If we're still on the same page for any reason, force fallback.
      // (We can't reliably detect route change here without extra state,
      // but this is light and works well in practice.)
      router.replace(fallbackHref);
    }, 120);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Back"
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-full",
        "hover:oura-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
        "transition",
        className,
      ].join(" ")}
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
    </button>
  );
}
