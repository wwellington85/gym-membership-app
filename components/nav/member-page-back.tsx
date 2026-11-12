"use client";
import { usePathname } from "next/navigation";
import { BackButton } from "@/components/ui/back-button";
import { memberPageParent } from "@/lib/member/navigation";

export function MemberPageBack() {
  const parent = memberPageParent(usePathname());
  return parent ? (
    <nav aria-label="Page navigation" className="mb-3">
      <BackButton fallbackHref={parent.href} label={parent.label} />
    </nav>
  ) : null;
}
