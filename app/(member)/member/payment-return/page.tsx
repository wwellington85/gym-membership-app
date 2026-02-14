"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui/back-button";

export default function PaymentReturnPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const reference = sp.get("reference") || "—";
  const customReference = sp.get("customReference") || sp.get("custom_reference") || sp.get("payment") || "";

  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<string>("checking");
  const [detail, setDetail] = useState<string>("");

  useEffect(() => {
    let alive = true;
    let tries = 0;

    async function tick() {
      tries += 1;

      if (!customReference) {
        setStatus("error");
        setDetail("Missing payment reference.");
        return;
      }

      const { data, error } = await supabase
        .from("payments")
        .select("id,status,amount,currency,provider,paid_on,updated_at")
        .eq("id", customReference)
        .maybeSingle();

      if (!alive) return;

      if (error || !data) {
        setStatus("error");
        setDetail(error?.message || "Payment not found.");
        return;
      }

      const st = String(data.status || "").toLowerCase();
      if (st === "paid" || st === "succeeded" || st === "success") {
        setStatus("paid");
        setDetail("Payment confirmed. Redirecting…");
        setTimeout(() => router.replace("/member/card"), 600);
        return;
      }

      setStatus("pending");
      setDetail("Still confirming your payment…");

      // Stop after ~60 seconds (20 tries at 3s)
      if (tries >= 20) return;
      setTimeout(tick, 3000);
    }

    tick();

    return () => {
      alive = false;
    };
  }, [customReference, router, supabase]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {status === "paid" ? "Payment received" : "Confirming payment"}
      </h1>

      <p className="text-sm opacity-70">
        {detail || "Thanks — we’re confirming your payment now. This usually updates within a few seconds."}
      </p>

      <div className="rounded border p-3 text-sm">
        <div>
          <span className="opacity-70">Fygaro reference:</span> {reference}
        </div>
        <div>
          <span className="opacity-70">Your reference:</span> {customReference || "—"}
        </div>
      </div>

      <div className="flex gap-2">
        <BackButton fallbackHref="/member" />
        <Link className="rounded border px-3 py-2 text-sm hover:oura-surface-muted" href="/member/card">
          View membership card
        </Link>
      </div>
    </div>
  );
}
