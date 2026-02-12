"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const tabs = [
  { href: "/member", label: "Dashboard" },
  { href: "/member/card", label: "Card" },
  { href: "/member/benefits", label: "Benefits" },
  { href: "/member/settings", label: "Settings" },
];

export function MemberTabs() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (typeof document === "undefined") return null;

  const nav = (
    <nav className="fixed bottom-0 left-0 right-0 z-[9999] border-t oura-tabbar pb-[env(safe-area-inset-bottom)] oura-bottom-tabbar">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-2 py-2">
        {tabs.map((t) => {
          const active =
            t.href === "/member"
              ? pathname === "/member"
              : pathname === t.href || pathname.startsWith(t.href + "/");

          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 px-1 py-2 text-center whitespace-nowrap text-[12px] leading-none sm:text-sm ${
                active ? "font-semibold oura-tab-active" : "opacity-70 oura-tab"
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
