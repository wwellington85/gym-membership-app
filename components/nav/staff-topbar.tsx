"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div className="fixed left-0 right-0 top-0 z-50 oura-topbar">
      <div className="flex w-full items-center justify-between px-3 py-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        {showBack ? (
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
          </button>
        ) : (
          <span className="h-9 w-9" aria-hidden="true" />
        )}
        <div className="my-1">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
