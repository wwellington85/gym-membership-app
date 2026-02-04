import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Suspense fallback={<div className="rounded border p-3 text-sm">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
