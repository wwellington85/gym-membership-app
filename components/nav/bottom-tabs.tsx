"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard,
  Users,
  Receipt,
  ScanLine,
  Ellipsis,
} from "lucide-react";
type Role = "admin" | "front_desk" | "security";
const tabs = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["admin", "front_desk", "security"],
  },
  {
    href: "/members",
    label: "Members",
    icon: Users,
    roles: ["admin", "front_desk", "security"],
  },
  {
    href: "/payments",
    label: "Payments",
    icon: Receipt,
    roles: ["admin", "front_desk"],
  },
  {
    href: "/checkins",
    label: "Visits",
    icon: ScanLine,
    roles: ["admin", "front_desk", "security"],
  },
  { href: "/more", label: "More", icon: Ellipsis, roles: ["admin"] },
];
export function BottomTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <nav aria-label="Employee navigation" className="club-staff-nav">
      <div className="club-nav-items">
        {tabs
          .filter((tab) => tab.roles.includes(role))
          .map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="club-nav-item"
              aria-current={
                pathname === href || pathname.startsWith(href + "/")
                  ? "page"
                  : undefined
              }
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
      </div>
    </nav>,
    document.getElementById("app-portal") ?? document.body,
  );
}
