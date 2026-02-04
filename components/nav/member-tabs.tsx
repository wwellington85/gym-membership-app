"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/member", label: "Dashboard" },
  { href: "/member/card", label: "Card" },
  { href: "/member/benefits", label: "Benefits" },
  { href: "/member/settings", label: "Settings" },
];

export function MemberTabs() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-2 py-2">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 rounded px-2 py-2 text-center text-sm ${
                active ? "font-semibold" : "opacity-70"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
