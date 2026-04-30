import { UpdatePasswordForm } from "@/components/update-password-form";
import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    returnTo?: string;
  }>;
}) {
  const sp = (await searchParams) ?? {};
  const code = String(sp.code ?? "").trim();
  const tokenHash = String(sp.token_hash ?? "").trim();
  const type = String(sp.type ?? "").trim();
  const returnTo = String(sp.returnTo ?? "").trim();

  if (code || (tokenHash && type)) {
    const qp = new URLSearchParams();
    if (code) qp.set("code", code);
    if (tokenHash) qp.set("token_hash", tokenHash);
    if (type) qp.set("type", type);
    qp.set("next", `/auth/update-password${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`);
    redirect(`/auth/confirm?${qp.toString()}`);
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <UpdatePasswordForm />
      </div>
    </div>
  );
}
