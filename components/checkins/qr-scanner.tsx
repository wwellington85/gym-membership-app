"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Props = { onScan: (text: string) => void };

export function QrScanner({ onScan }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    return () => {
      try {
        readerRef.current?.reset();
      } catch {}
    };
  }, []);

  async function start() {
    setErr("");
    if (!videoRef.current) return;

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      setRunning(true);

      await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result) => {
          if (result) {
            const text = result.getText();
            stop();
            onScan(text);
          }
        }
      );
    } catch (e: any) {
      setRunning(false);
      setErr(e?.message || "Could not start camera.");
    }
  }

  function stop() {
    try {
      readerRef.current?.reset();
    } catch {}
    setRunning(false);
  }

  return (
    <div className="rounded border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Camera scan</div>
        {!running ? (
          <button type="button" onClick={start} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">
            Start
          </button>
        ) : (
          <button type="button" onClick={stop} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">
            Stop
          </button>
        )}
      </div>

      {err ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs">{err}</div>
      ) : null}

      <div className="overflow-hidden rounded border bg-black">
        <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
      </div>

      <div className="text-xs opacity-70">
        Tip: On iPhone, ensure Safari has camera permission enabled for this site.
      </div>
    </div>
  );
}
