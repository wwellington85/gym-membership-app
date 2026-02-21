"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Role = "admin" | "front_desk" | "security";
type Props = { role: Role };

type Tab = {
  href: string;
  label: string;
  roles?: Role[];      // if omitted, everyone sees it
  adminOnly?: boolean; // backward compatibility if you still use it elsewhere
};

const tabs: Tab[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/members", label: "Members" },

  // Front desk workflow: keep Applications visible
  { href: "/applications", label: "Applications", roles: ["front_desk"] },

  // Shared operational tabs
  { href: "/payments", label: "Payments", roles: ["admin", "front_desk"] },
  { href: "/checkins", label: "Check-ins" },

  // Admin: keep bottom bar compact, move rarely-used destinations under "More"
  { href: "/more", label: "More", roles: ["admin"] },
];

export function BottomTabs({ role }: Props) {
  const pathname = usePathname();
  const isAdmin = role === "admin";
  const [mounted, setMounted] = useState(false);

  const visibleTabs = useMemo(() => {
    return tabs.filter((t) => {
      if (t.roles) return t.roles.includes(role);
      if (t.adminOnly) return isAdmin;
      return true;
    });
  }, [role, isAdmin]);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;
  if (typeof document === "undefined") return null;

  const host = document.getElementById("app-portal") ?? document.body;

  const nav = (
    <nav className="fixed bottom-[calc(env(safe-area-inset-bottom)+8px)] left-0 right-0 z-[9999] border-t oura-tabbar oura-bottom-tabbar">
      <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-2 py-3">
        {visibleTabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              prefetch
              className={`flex-1 rounded px-1 py-2 text-center whitespace-nowrap text-[12px] leading-none sm:text-sm ${
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

  return createPortal(nav, host);
}
