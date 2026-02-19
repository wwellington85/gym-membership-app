"use client";

import { usePathname, useRouter } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";

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

  function onBack() {
    router.back();
    setTimeout(() => {
      router.replace(fallbackFor(pathname));
    }, 120);
  }

  return (
    <div className="sticky top-0 z-40 border-b oura-tabbar">
      <div className="mx-auto flex w-full items-center justify-between px-3 py-2">
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          className="inline-flex h-9 w-9 items-center justify-center rounded border text-lg leading-none hover:oura-surface-muted"
        >
          {"<"}
        </button>
        <LogoutButton />
      </div>
    </div>
  );
}
