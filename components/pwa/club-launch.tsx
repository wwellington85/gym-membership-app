"use client";
import { useEffect, useState } from "react";

export function ClubLaunch() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (
      !window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Once per installed-app session; never block navigation or QR access.
    try {
      if (sessionStorage.getItem("club-intro-seen")) return;
      sessionStorage.setItem("club-intro-seen", "1");
    } catch {
      return;
    }
    setShow(true);
  }, []);
  if (!show) return null;
  return (
    <div
      className="club-launch"
      aria-hidden="true"
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) setShow(false);
      }}
    >
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
  );
}
