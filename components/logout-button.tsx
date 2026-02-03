"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    setLoading(false);
    router.replace("/auth/login");
  };

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className="rounded border px-3 py-1.5 text-sm disabled:opacity-60"
    >
      {loading ? "Logging out…" : "Log out"}
    </button>
  );
}
