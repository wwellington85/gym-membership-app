"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { House, CreditCard, Gift, UserRound } from "lucide-react";
import { memberTab } from "@/lib/member/navigation";
const tabs = [
  { href: "/member", label: "Home", icon: House },
  { href: "/member/card", label: "Card", icon: CreditCard },
  { href: "/member/benefits", label: "Benefits", icon: Gift },
  { href: "/member/settings", label: "Account", icon: UserRound },
];
export function MemberTabs() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <nav aria-label="Member navigation" className="club-member-nav">
      <div className="club-nav-items">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={memberTab(pathname) === href ? "page" : undefined}
            className="club-nav-item"
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>,
    document.body,
  );
}
