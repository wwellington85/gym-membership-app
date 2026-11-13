"use client";
/* eslint-disable @next/next/no-img-element -- QR data images are generated locally. */
import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";
export function RotatingQr({ size = 240 }: { size?: number }) {
  const [qr, setQr] = useState<{ url: string; exp: number } | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/qr/token", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (!json.token || !Number.isFinite(json.exp)) throw new Error();
      const url = await QRCode.toDataURL(json.token, {
        errorCorrectionLevel: "M",
        margin: 4,
        scale: 8,
      });
      setQr({ url, exp: json.exp });
      setError("");
      try {
        localStorage.setItem("tbr_card_used", "1");
      } catch {
        /* optional convenience */
      }
    } catch {
      setError(
        "We could not refresh your QR. Retry, or ask staff to look up your membership number.",
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const refreshTimer = setInterval(refresh, 30000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    const resume = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        void refresh();
      }
    };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(refreshTimer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);
  const valid = qr && qr.exp * 1000 > now;
  return (
    <div className="flex flex-col items-center gap-3 py-3">
      {valid && (
        <img
          src={qr.url}
          width={size}
          height={size}
          className="max-w-full rounded bg-white"
          alt="Membership QR for staff verification"
        />
      )}
      {!valid && (
        <p role="status" className="text-sm">
          {loading
            ? "Loading your QR…"
            : "QR unavailable. Use your membership number for staff lookup."}
        </p>
      )}
      {error && (
        <p role="status" className="text-sm">
          {error}
        </p>
      )}
      {valid && (
        <p className="text-xs text-muted-foreground">
          Updates automatically · Valid for{" "}
          {Math.max(0, Math.ceil(qr.exp - now / 1000))} seconds
        </p>
      )}
      {error && (
        <button
          disabled={loading}
          onClick={refresh}
          className="rounded border px-4 py-3 text-sm"
        >
          {loading ? "Retrying…" : "Retry QR"}
        </button>
      )}
    </div>
  );
}
