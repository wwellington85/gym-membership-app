"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Role = "admin" | "front_desk" | "security" | string;
type Props = { role: Role };

const tabs = [
  { href: "/dashboard", label: "Dashboard", roles: ["admin", "front_desk", "security"] },
  { href: "/members", label: "Members", roles: ["admin", "front_desk", "security"] },
  { href: "/checkins", label: "Check-ins", roles: ["admin", "front_desk", "security"] },
  { href: "/payments", label: "Payments", roles: ["admin", "front_desk"] },
  { href: "/settings", label: "Settings", roles: ["admin"] },
  { href: "/account", label: "Account", roles: ["admin", "front_desk", "security"] },
];

export function BottomTabs({ role }: Props) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-white">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {tabs
          .filter((t) => t.roles.includes(role))
          .map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`whitespace-nowrap rounded px-2 py-2 text-xs ${
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
