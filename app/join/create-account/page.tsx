import { Suspense } from "react";
import CreateAccountClient from "./create-account-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Suspense fallback={<div className="rounded border p-3 text-sm">Loading…</div>}>
        <CreateAccountClient />
      </Suspense>
    </div>
  );
}
