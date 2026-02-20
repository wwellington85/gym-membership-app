"use client";

import { useEffect, useMemo, useState } from "react";

type Audience = "staff" | "member";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const SESSION_MARK = "tbr_install_prompt_session_mark";
const SESSION_COUNT_KEY = "tbr_install_prompt_session_count";
const DISMISSED_AT_KEY = "tbr_install_prompt_dismissed_at";
const DISMISSED_SESSION_KEY = "tbr_install_prompt_dismissed_session_count";
const INSTALLED_KEY = "tbr_install_prompt_installed";
const VERSION_KEY = "tbr_install_prompt_version";
const VERSION = "v1";

function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isLikelyMobile() {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const mobileUa = /android|iphone|ipad|ipod|mobile/.test(ua);
  const narrow = window.matchMedia("(max-width: 1024px)").matches;
  return mobileUa || narrow;
}

function readNumber(key: string, fallback = 0) {
  const v = Number(localStorage.getItem(key) || "");
  return Number.isFinite(v) ? v : fallback;
}

function markDismissed(sessionCount: number) {
  localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  localStorage.setItem(DISMISSED_SESSION_KEY, String(sessionCount));
}

export function InstallAppPrompt({ audience }: { audience: Audience }) {
  const [visible, setVisible] = useState(false);
  const [iosLike, setIosLike] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSteps, setShowSteps] = useState(false);

  const title = audience === "staff" ? "Install Staff App" : "Install Membership App";
  const subtitle =
    audience === "staff"
      ? "Faster check-ins and fewer browser issues at the desk and gate."
      : "Get faster access to your card, benefits, and membership updates.";

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Reset cadence keys if logic version changes.
    if (localStorage.getItem(VERSION_KEY) !== VERSION) {
      localStorage.removeItem(DISMISSED_AT_KEY);
      localStorage.removeItem(DISMISSED_SESSION_KEY);
      localStorage.removeItem(INSTALLED_KEY);
      localStorage.setItem(VERSION_KEY, VERSION);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIosLike(/iphone|ipad|ipod/.test(ua));

    const onBeforeInstallPrompt = (ev: Event) => {
      ev.preventDefault();
      setDeferredPrompt(ev as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    // Track usage session count only once per browser tab session.
    if (!sessionStorage.getItem(SESSION_MARK)) {
      const nextCount = readNumber(SESSION_COUNT_KEY) + 1;
      localStorage.setItem(SESSION_COUNT_KEY, String(nextCount));
      sessionStorage.setItem(SESSION_MARK, "1");
    }

    const installed = isStandalone() || localStorage.getItem(INSTALLED_KEY) === "1";
    if (installed) {
      localStorage.setItem(INSTALLED_KEY, "1");
      setVisible(false);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      };
    }

    if (!isLikelyMobile()) {
      setVisible(false);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      };
    }

    const sessionCount = readNumber(SESSION_COUNT_KEY);
    const dismissedAt = readNumber(DISMISSED_AT_KEY);
    const dismissedAtSession = readNumber(DISMISSED_SESSION_KEY);

    // First authenticated session: prompt.
    if (!dismissedAt) {
      setVisible(true);
      return () => {
        window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      };
    }

    const sessionsSinceDismiss = sessionCount - dismissedAtSession;
    const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

    // Re-prompt every 5 sessions OR after 14 days.
    if (sessionsSinceDismiss >= 5 || daysSinceDismiss >= 14) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const canOneTapInstall = useMemo(() => Boolean(deferredPrompt), [deferredPrompt]);
  if (!visible) return null;

  async function handleInstallNow() {
    const sessionCount = readNumber(SESSION_COUNT_KEY);

    if (!deferredPrompt) {
      setShowSteps(true);
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (choice.outcome === "accepted") {
      localStorage.setItem(INSTALLED_KEY, "1");
      setVisible(false);
      return;
    }

    markDismissed(sessionCount);
    setVisible(false);
  }

  function handleNotNow() {
    const sessionCount = readNumber(SESSION_COUNT_KEY);
    markDismissed(sessionCount);
    setVisible(false);
  }

  function handleAlreadyInstalled() {
    localStorage.setItem(INSTALLED_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="mb-3 rounded border border-white/20 bg-black/25 p-3 text-sm">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 opacity-80">{subtitle}</div>

      {canOneTapInstall ? (
        <div className="mt-2 opacity-80">Install for full-screen access and faster launch.</div>
      ) : iosLike ? (
        <div className="mt-2 opacity-80">Tap Install to view iPhone steps (Safari required).</div>
      ) : (
        <div className="mt-2 opacity-80">Use your browser menu and choose Install app.</div>
      )}

      {showSteps && !canOneTapInstall ? (
        <div className="mt-2 rounded border border-white/15 p-2 text-xs opacity-90">
          {iosLike ? (
            <>
              1) Open this site in Safari.
              <br />
              2) Tap Share.
              <br />
              3) Tap Add to Home Screen.
            </>
          ) : (
            <>Open browser menu and choose Install app or Add to Home screen.</>
          )}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleInstallNow}
          className="rounded border px-3 py-1.5 text-sm hover:oura-surface-muted"
        >
          {canOneTapInstall ? "Install now" : "Install"}
        </button>
        <button
          type="button"
          onClick={handleAlreadyInstalled}
          className="rounded border px-3 py-1.5 text-sm opacity-80 hover:opacity-100"
        >
          Already installed
        </button>
        <button
          type="button"
          onClick={handleNotNow}
          className="rounded border px-3 py-1.5 text-sm opacity-80 hover:opacity-100"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
