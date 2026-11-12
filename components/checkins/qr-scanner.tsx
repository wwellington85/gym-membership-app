"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
export function QrScanner({
  lookup,
}: {
  lookup: (data: FormData) => Promise<void>;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const controls = useRef<IScannerControls | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  useEffect(() => () => controls.current?.stop(), []);
  function stop() {
    controls.current?.stop();
    controls.current = null;
    setRunning(false);
  }
  async function start() {
    if (!video.current) return;
    setError("");
    setRunning(true);
    let detected = false;
    try {
      const scannerControls =
        await new BrowserMultiFormatReader().decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (result) => {
            if (!result || detected) return;
            detected = true;
            stop();
            const data = new FormData();
            data.set("code", result.getText());
            startTransition(async () => {
              await lookup(data);
            });
          },
        );
      controls.current = scannerControls;
      if (detected) {
        scannerControls.stop();
        controls.current = null;
      }
    } catch {
      setRunning(false);
      setError(
        "Camera unavailable. Allow camera access in your browser, or use member lookup below.",
      );
    }
  }
  return (
    <div className="space-y-3 rounded border p-3">
      <div className="flex justify-between gap-3">
        <h2 className="font-medium">Scan membership card</h2>
        <button
          type="button"
          disabled={pending}
          onClick={running ? stop : start}
          className="rounded border px-4 py-3 text-sm"
        >
          {pending ? "Looking up…" : running ? "Stop camera" : "Start camera"}
        </button>
      </div>
      <video
        ref={video}
        muted
        playsInline
        className="h-56 w-full rounded bg-black object-cover"
      />
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <p className="text-sm opacity-80">
        Scanning identifies a member. It does not record a visit or grant
        access.
      </p>
    </div>
  );
}
