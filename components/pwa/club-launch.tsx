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
    const timeout = window.setTimeout(() => setShow(false), 750);
    return () => window.clearTimeout(timeout);
  }, []);
  if (!show) return null;
  return (
    <div className="club-launch" aria-hidden="true">
      <span className="club-launch-emblem" />
      <span>TRAVELLERS CLUB</span>
    </div>
  );
}
