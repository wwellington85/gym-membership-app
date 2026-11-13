"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { backDestination } from "@/lib/member/navigation";

export function BackButton({
  fallbackHref = "/member",
  className = "",
  label = "Back",
}: {
  fallbackHref?: string;
  className?: string;
  label?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = backDestination(
    searchParams.get("returnTo"),
    fallbackHref,
    pathname,
  );
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:oura-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <ArrowLeft className="h-5 w-5" strokeWidth={2.4} aria-hidden="true" />
      {label}
    </Link>
  );
}
