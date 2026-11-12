"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { memberTab } from "@/lib/member/navigation";

const tabs = [
  { href: "/member", label: "Home" },
  { href: "/member/gym", label: "Gym" },
  { href: "/member/card", label: "Card" },
  { href: "/member/benefits", label: "Benefits" },
  { href: "/member/settings", label: "Account" },
];

export function MemberTabs() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (typeof document === "undefined") return null;

  const nav = (
    <nav
      aria-label="Member navigation"
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t oura-tabbar oura-bottom-tabbar"
    >
      <div className="mx-auto flex max-w-md items-center justify-between gap-1 px-2 pt-3 pb-[calc(env(safe-area-inset-bottom)+10px)]">
        {tabs.map((t) => {
          const active = memberTab(pathname) === t.href;

          return (
            <Link
              key={t.href}
              aria-current={active ? "page" : undefined}
              href={t.href}
              prefetch
              className={`flex-1 px-1 py-2 text-center whitespace-nowrap text-[13px] leading-none ${
                active ? "font-semibold oura-tab-active" : "oura-tab"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );

  return createPortal(nav, document.body);
}
