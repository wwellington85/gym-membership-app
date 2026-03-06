"use client";

import { useEffect, useRef } from "react";

export function AutoSubmitCheckin({ enabled }: { enabled: boolean }) {
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!enabled || submittedRef.current) return;
    const form = document.getElementById("scan-checkin-form") as HTMLFormElement | null;
    if (!form) return;
    submittedRef.current = true;
    form.requestSubmit();
  }, [enabled]);

  return null;
}
