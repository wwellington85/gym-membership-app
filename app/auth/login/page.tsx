import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

import { googleSignInEnabled } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="w-full py-2">
      <Suspense
        fallback={<div className="rounded border p-3 text-sm">Loading…</div>}
      >
        <LoginForm googleEnabled={googleSignInEnabled()} />
      </Suspense>
    </div>
  );
}
