"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
export default function PaymentReturnPage() {
  const sp = useSearchParams();
  const reference =
    sp.get("customReference") ||
    sp.get("custom_reference") ||
    sp.get("payment") ||
    "";
  const [message, setMessage] = useState("Checking your payment and access…");
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let tries = 0;
    const controller = new AbortController();
    async function check() {
      try {
        if (!reference)
          throw new Error(
            "No payment reference was supplied. Open My account to find your purchase.",
          );
        const res = await fetch(
          `/api/member/payments/${encodeURIComponent(reference)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payment = await res.json();
        if (!res.ok)
          throw new Error(
            payment.error || "We could not check payment status.",
          );
        if (!alive) return;
        if (payment.status === "paid" && payment.fulfilled_at) {
          setReady(true);
          setChecking(false);
          setMessage(
            `Payment received and access activated: ${payment.access_start_date} through ${payment.access_end_date}, until 10 pm Jamaica time on the last day.`,
          );
          return;
        }
        if (
          ["failed", "cancelled", "canceled", "refunded"].includes(
            payment.status,
          )
        ) {
          setChecking(false);
          setMessage(
            `Payment status: ${payment.status}. Please contact the front desk if you need help.`,
          );
          return;
        }
        if (++tries >= 20 || payment.status === "paid") {
          setChecking(false);
          setMessage(
            "Your purchase needs confirmation. Do not pay again. Check status again or show your reference to the front desk.",
          );
          return;
        }
        setMessage(
          "Still confirming payment and access. Do not pay again while this is processing.",
        );
        timer = setTimeout(check, 3000);
      } catch (error) {
        if (alive) {
          setChecking(false);
          setMessage(
            error instanceof Error ? error.message : "Please try again.",
          );
        }
      }
    }
    setChecking(true);
    setReady(false);
    void check();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [reference, attempt]);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {ready ? "Your access is ready" : "Payment status"}
      </h1>
      <p role="status">{message}</p>
      <p className="break-all rounded border p-3 text-sm">
        Your reference: {reference || "Not supplied"}
      </p>
      <div className="flex flex-wrap gap-3">
        {ready ? (
          <Link href="/member/card" className="rounded border p-3">
            Show my card
          </Link>
        ) : (
          <button
            disabled={checking}
            onClick={() => setAttempt((n) => n + 1)}
            className="rounded border p-3 disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check status again"}
          </button>
        )}
        <Link href="/member/settings" className="rounded border p-3">
          My purchases
        </Link>
        <Link href="/member/help" className="rounded border p-3">
          Get help
        </Link>
      </div>
    </div>
  );
}
