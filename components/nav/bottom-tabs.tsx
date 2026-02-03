"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  { href: "/applications", label: "Applications", roles: ["admin", "front_desk"] },
  { href: "/payments", label: "Payments", roles: ["admin", "front_desk"] },
  { href: "/checkins", label: "Check-ins" },
  { href: "/settings", label: "Settings", roles: ["admin"] },
];

export function BottomTabs({ role }: Props) {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  const visibleTabs = tabs.filter((t) => {
    if (t.roles) return t.roles.includes(role);
    if (t.adminOnly) return isAdmin;
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white z-50 pb-[env(safe-area-inset-bottom)] shrink-0">
      <div className="mx-auto flex max-w-md items-center justify-start px-2 py-2 shrink-0 no-scrollbar overflow-x-auto overflow-y-hidden flex-nowrap min-w-max gap-2 [-webkit-overflow-scrolling:touch]">
        {visibleTabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded px-2 py-2 text-sm whitespace-nowrap ${
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
