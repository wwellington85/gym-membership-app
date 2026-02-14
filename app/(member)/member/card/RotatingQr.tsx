"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type Props = { size?: number };

export function RotatingQr({ size = 240 }: Props) {
  const [token, setToken] = useState<string>("");
  const [dataUrl, setDataUrl] = useState<string>("");
  const [exp, setExp] = useState<number | null>(null);
  const [err, setErr] = useState<string>("");

  async function refresh() {
    setErr("");
    try {
      const res = await fetch("/api/qr/token", { cache: "no-store" });
      if (!res.ok) throw new Error(`token fetch failed (${res.status})`);
      const json = await res.json();
      const t = String(json?.token || "");
      const e = Number(json?.exp || 0);
      if (!t) throw new Error("missing token");
      setToken(t);
      setExp(Number.isFinite(e) ? e : null);

      const url = await QRCode.toDataURL(t, {
        errorCorrectionLevel: "M",
        margin: 1,
        scale: 8,
      });
      setDataUrl(url);
    } catch (e: any) {
      setErr(e?.message || "Could not load QR");
      setToken("");
      setDataUrl("");
      setExp(null);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  const expiresIn = useMemo(() => {
    if (!exp) return null;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, exp - now);
  }, [exp, token]);

  return (
    <div className="mt-4 flex flex-col items-center justify-center">
      {err ? (
        <div className="w-full rounded border border-red-200 bg-red-50 p-3 text-sm">
          {err}
        </div>
      ) : null}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      {dataUrl ? <img src={dataUrl} alt="Member QR Code" className="rounded border" style={{ width: size, height: size }} /> : null}

      <div className="mt-3 text-center text-xs opacity-70">
        Staff: scan this QR to check you in.
        {expiresIn != null ? <span> (refreshes — ~{expiresIn}s)</span> : null}
      </div>
    </div>
  );
}
