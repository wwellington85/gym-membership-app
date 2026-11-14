"use client";
import { useEffect, useState, useRef, useId } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import { RewardIcon } from "./reward-icon";
type Item = { id: string; title: string; icon: string };
export function RewardNotice() {
  const [items, setItems] = useState<Item[]>([]),
    [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    let disposed = false;
    let busy = false;
    const controller = new AbortController();
    async function refresh() {
      if (busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const res = await fetch("/api/rewards/notifications", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (disposed) return;
        if (res.status === 401) {
          setItems([]);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (!disposed) setItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
      } finally {
        busy = false;
      }
    }
    void refresh();
    const timer = setInterval(refresh, 45000);
    const changed = (e?: Event) => {
      if (e instanceof CustomEvent && typeof e.detail === "string")
        setItems((rows) => rows.filter((g) => g.id !== e.detail));
      void refresh();
    };
    window.addEventListener("focus", changed);
    window.addEventListener("club-rewards-read", changed);
    document.addEventListener("visibilitychange", changed);
    const outside = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("focus", changed);
      window.removeEventListener("club-rewards-read", changed);
      document.removeEventListener("visibilitychange", changed);
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  return (
    <div
      ref={container}
      className="relative flex h-11 w-11 shrink-0 items-center justify-center"
      onKeyDown={(e) => {
        if (e.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="club-member-header-action relative"
        aria-label={
          items.length
            ? `${items.length} new reward${items.length === 1 ? "" : "s"}`
            : "Reward notifications"
        }
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={21} aria-hidden="true" />
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <div
          id={id}
          role="region"
          aria-label="Reward notifications"
          className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto w-[min(320px,calc(100vw-40px))] space-y-3 rounded-2xl border bg-background p-4 text-foreground shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <strong className="text-sm">Your rewards</strong>
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="p-2"
            >
              <X size={18} />
            </button>
          </div>
          {items.length ? (
            items.map((g) => (
              <Link
                key={g.id}
                prefetch={false}
                href={`/member/rewards/${g.id}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl bg-secondary p-3 text-sm"
              >
                <RewardIcon icon={g.icon} />
                <span>A little thank-you: {g.title}</span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No new rewards right now.
            </p>
          )}
          <Link
            href="/member/benefits#member-rewards"
            onClick={() => setOpen(false)}
            className="club-text-link text-sm"
          >
            View all rewards
          </Link>
          <Link
            href="/member/settings#notifications"
            onClick={() => setOpen(false)}
            className="block py-2 text-xs underline"
          >
            Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}
