"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  ScanLine,
  Dumbbell,
  Inbox,
  Receipt,
  Settings,
  UserRound,
} from "lucide-react";
export function StaffSidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const security = role === "security";
  const links = [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { href: "/members", label: "Members", icon: Users },
    { href: "/checkins/scan", label: "Verify member", icon: ScanLine },
    { href: "/checkins", label: "Gym visits", icon: Dumbbell },
    ...(!security
      ? [
          { href: "/applications", label: "Requests", icon: Inbox },
          { href: "/payments", label: "Payments", icon: Receipt },
        ]
      : []),
    ...(role === "admin"
      ? [{ href: "/more", label: "Programme & admin", icon: Settings }]
      : []),
    { href: "/account", label: "My staff account", icon: UserRound },
  ];
  return (
    <aside
      className="staff-sidebar bottom-0 left-0 top-[calc(env(safe-area-inset-top)+68px)] z-30 hidden w-56 space-y-2 p-4 md:block"
      aria-label="Employee navigation"
    >
      <p className="club-eyebrow mb-4 px-3">Staff workspace</p>
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          (pathname === href || pathname.startsWith(href + "/")) &&
          !(href === "/checkins" && pathname.startsWith("/checkins/scan"));
        return (
          <Link
            key={href}
            href={href}
            className="club-sidebar-link"
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
