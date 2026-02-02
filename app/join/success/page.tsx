"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function JoinSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/join?success=1");
    }, 2500);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-10">
      <h1 className="text-xl font-semibold">Thanks! We received your request.</h1>
      <p className="mt-2 text-sm opacity-70">Redirecting…</p>
    </div>
  );
}
