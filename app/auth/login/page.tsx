import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="w-full py-2">
      <Suspense fallback={<div className="rounded border p-3 text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
