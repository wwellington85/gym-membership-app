"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
const destinations = new Set([
  "/member",
  "/dashboard",
  "/checkins/scan",
  "/auth/login",
  "/auth/post-login",
]);

export function AppEntry({
  installedOnly = false,
}: {
  installedOnly?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (
      installedOnly &&
      !window.matchMedia("(display-mode: standalone)").matches
    )
      return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let cancelled = false;
    setError(false);
    void (async () => {
      try {
        const response = await fetch("/api/app-entry", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Entry unavailable");
        const data = await response.json();
        if (!destinations.has(data.destination))
          throw new Error("Invalid destination");
        if (!cancelled) router.replace(data.destination);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        window.clearTimeout(timeout);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [router, installedOnly, attempt]);
  if (!error)
    return installedOnly ? null : (
      <main id="main-content" className="club-entry-status">
        <p role="status">Opening Travellers Club…</p>
      </main>
    );
  const Container = installedOnly ? "section" : "main";
  return (
    <Container
      id={installedOnly ? undefined : "main-content"}
      className="club-entry-status"
      data-club-entry-ready
    >
      <section className="oura-card space-y-4 p-5">
        <h1 className="text-xl font-semibold">Let’s get you back in.</h1>
        <p role="alert">
          We couldn’t open your account. Check your connection and try again.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="club-button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Try again
          </button>
          <Link href="/auth/login" className="club-button-secondary">
            Go to sign in
          </Link>
        </div>
      </section>
    </Container>
  );
}
