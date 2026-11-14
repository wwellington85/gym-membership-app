"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function ClubLaunch() {
  const pathname = usePathname();
  const eligible = pathname === "/member" || pathname === "/member/start";
  const [phase, setPhase] = useState<"holding" | "leaving" | "hidden">(
    "holding",
  );
  const completed = useRef(false);
  useEffect(() => {
    if (
      !eligible ||
      !window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      completed.current = true;
      setPhase("hidden");
      return;
    }
    // Root layout survives in-app navigation: one intro per document launch.
    // Do not dismiss a server-rendered logo abruptly based on a stale iOS session.
    if (completed.current) {
      setPhase("hidden");
      return;
    }
    let cancelled = false;
    let preparing = false;
    let leaving = false;
    let holdTimer: number | undefined;
    const started = Date.now();
    const leave = () => {
      if (!cancelled && !leaving) {
        leaving = true;
        completed.current = true;
        setPhase("leaving");
      }
    };
    const ready = async () => {
      if (preparing || !document.querySelector("[data-club-home-ready]"))
        return;
      preparing = true;
      observer.disconnect();
      const hero = document.querySelector<HTMLImageElement>(
        "[data-club-home-ready] img",
      );
      // Let the hero paint before revealing Home, without waiting indefinitely
      // on a slow image. The five-second escape also covers a page-load error.
      if (hero && !hero.complete) {
        try {
          await hero.decode();
        } catch {
          /* Reveal the usable page on image failure. */
        }
      }
      if (!cancelled && !leaving)
        holdTimer = window.setTimeout(
          leave,
          Math.max(0, 1100 - (Date.now() - started)),
        );
    };
    const observer = new MutationObserver(() => {
      void ready();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    void ready();
    const escape = window.setTimeout(leave, 5000);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.clearTimeout(holdTimer);
      window.clearTimeout(escape);
    };
  }, [eligible]);
  if (!eligible || phase === "hidden") return null;
  return (
    <div
      className={`club-launch${phase === "leaving" ? " club-launch-leaving" : ""}`}
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (phase === "leaving" && event.target === event.currentTarget)
          setPhase("hidden");
      }}
    >
      <div className="club-launch-brand">
        {/* Inline the selected mark so it paints with the title on a cold launch. */}
        <svg
          className="club-launch-emblem"
          viewBox="0 0 1024 1024"
          focusable="false"
          aria-hidden="true"
        >
          <rect width="1024" height="1024" fill="#1d3f56" />
          <defs>
            <mask
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="1024"
              height="1024"
              id="club-launch-t-cut"
            >
              <rect width="1024" height="1024" fill="white" />
              <path
                d="M793 380a200 200 0 1 0 0 282"
                fill="none"
                stroke="black"
                strokeWidth="100"
                strokeLinecap="round"
              />
            </mask>
            <mask
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="1024"
              height="1024"
              id="club-launch-c-cut"
            >
              <rect width="1024" height="1024" fill="white" />
              <path d="M190 245h510v112H500v422H388V357H190z" fill="black" />
            </mask>
          </defs>
          <path
            d="M190 245h510v112H500v422H388V357H190z"
            fill="#fff"
            mask="url(#club-launch-t-cut)"
          />
          <path
            d="M793 380a200 200 0 1 0 0 282"
            fill="none"
            stroke="#dccb96"
            strokeWidth="100"
            strokeLinecap="round"
            mask="url(#club-launch-c-cut)"
          />
        </svg>
        <span>TRAVELLERS CLUB</span>
      </div>
    </div>
  );
}
