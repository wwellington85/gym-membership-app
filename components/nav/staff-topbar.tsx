"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

const KEY_PREV = "tbr_prev_path";

function fallbackFor(pathname: string) {
  if (pathname.startsWith("/members")) return "/members";
  if (pathname.startsWith("/payments")) return "/payments";
  if (pathname.startsWith("/checkins")) return "/checkins";
  if (pathname.startsWith("/applications")) return "/applications";
  if (pathname.startsWith("/settings")) return "/settings";
  if (pathname.startsWith("/more")) return "/more";
  if (pathname.startsWith("/account")) return "/account";
  return "/dashboard";
}

export function StaffTopbar() {
  const router = useRouter();
  const pathname = usePathname() || "/dashboard";
  const showBack = pathname !== "/dashboard";

  function onBack() {
    if (typeof window !== "undefined") {
      const prevPath = sessionStorage.getItem(KEY_PREV);
      if (prevPath && prevPath !== pathname) {
        router.replace(prevPath);
        return;
      }

      if (window.history.length <= 1) {
        router.replace(fallbackFor(pathname));
        return;
      }
    }

    router.back();
  }

  return (
    <div className="sticky top-0 z-40 border-b oura-topbar">
      <div className="mx-auto flex w-full items-center justify-between px-3 py-2 pt-[max(env(safe-area-inset-top),0px)]">
        {showBack ? (
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded border text-lg leading-none hover:oura-surface-muted"
          >
            {"<"}
          </button>
        ) : (
          <span className="h-9 w-9" aria-hidden="true" />
        )}
        <LogoutButton />
      </div>
    </div>
  );
}
