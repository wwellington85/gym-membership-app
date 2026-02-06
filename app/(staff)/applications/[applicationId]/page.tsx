import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FlashBanners } from "@/components/ui/flash-banners";

import { safeReturnTo } from "@/lib/auth/return-to";

type Role = "admin" | "front_desk" | "security";
type Status = "pending" | "contacted" | "converted" | "canceled";


function withParam(url: string, key: string, value: string) {
  const [path, qs = ""] = url.split("?");
  const params = new URLSearchParams(qs);
  params.set(key, value);
  const next = params.toString();
  return next ? `${path}?${next}` : path;
}

export default async function ApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams?: Promise<{ back?: string; err?: string; saved?: string }>;
}) {
  const { applicationId } = await params;
  const sp = (await searchParams) ?? {};
  const backTo = safeReturnTo(sp.back || "/applications");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!staffProfile) redirect("/auth/login");

  const role = staffProfile.role as Role;
  if (role !== "admin" && role !== "front_desk") redirect("/dashboard");

  const { data: app, error } = await supabase
    .from("membership_applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (error || !app) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">Application</h1>
        <div className="rounded border p-3 text-sm">
          Could not load application.
          <div className="mt-1 text-xs opacity-70">{error?.message}</div>
        </div>
        <Link className="underline underline-offset-2" href={backTo}>
          Back to Applications
        </Link>
      </div>
    );
  }

  async function setStatus(formData: FormData) {
    "use server";

    const returnTo = safeReturnTo(String(formData.get("returnTo") || "/applications"));
    const status = String(formData.get("status") || "").trim() as Status;
    const id = String(formData.get("id") || "").trim();

    if (!id) redirect(withParam(returnTo, "err", "Missing id"));
    if (!["pending", "contacted", "converted", "canceled"].includes(status)) {
      redirect(withParam(returnTo, "err", "Invalid status"));
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const { data: staffProfile } = await supabase
      .from("staff_profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!staffProfile) redirect("/auth/login");

    const role = staffProfile.role as Role;
    if (role !== "admin" && role !== "front_desk") redirect("/dashboard");

    const { error } = await supabase
      .from("membership_applications")
      .update({ status })
      .eq("id", id);

    if (error) redirect(withParam(returnTo, "err", error.message));

    redirect(withParam(returnTo, "saved", "1"));
  }

  const backEncoded = encodeURIComponent(backTo);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Application</h1>
          <p className="text-sm opacity-70">Status: {app.status}</p>
        </div>
        <Link className="rounded border px-3 py-2 text-sm hover:bg-gray-50" href={backTo}>
          Back
        </Link>
      </div>

      <FlashBanners />

      <div className="rounded border p-4 space-y-2">
        <div className="font-medium">{app.full_name}</div>
        <div className="text-sm opacity-70">
          {app.email || "(no email)"}{app.phone ? ` • ${app.phone}` : ""}
        </div>

        <div className="text-sm">
          <div>
            Plan: <span className="font-medium">{app.requested_plan_code}</span>
          </div>
          <div>
            Start date:{" "}
            <span className="font-medium">{app.requested_start_date || "(not set)"}</span>
          </div>
        </div>

        {app.notes ? (
          <div className="rounded border p-3 text-sm">
            <div className="font-medium">Notes</div>
            <div className="mt-1 opacity-70 whitespace-pre-wrap">{app.notes}</div>
          </div>
        ) : null}

        {app.waiver_accepted ? (
          <div className="text-xs opacity-60">
            Waiver accepted{app.waiver_accepted_at ? `: ${app.waiver_accepted_at}` : ""}.
          </div>
        ) : (
          <div className="text-xs opacity-60">Waiver not recorded.</div>
        )}

        <div className="text-xs opacity-60">Submitted: {app.created_at}</div>
      </div>

      <div className="rounded border p-4 space-y-2">
        <div className="font-medium">Actions</div>

        <div className="grid grid-cols-2 gap-2">
          <form action={setStatus}>
            <input type="hidden" name="id" value={app.id} />
            <input type="hidden" name="status" value="contacted" />
            <input
              type="hidden"
              name="returnTo"
              value={`/applications/${app.id}?back=${backEncoded}`}
            />
            <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Mark Contacted
            </button>
          </form>

          <form action={setStatus}>
            <input type="hidden" name="id" value={app.id} />
            <input type="hidden" name="status" value="pending" />
            <input
              type="hidden"
              name="returnTo"
              value={`/applications/${app.id}?back=${backEncoded}`}
            />
            <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Back to Pending
            </button>
          </form>

          <form action={setStatus} className="col-span-2">
            <input type="hidden" name="id" value={app.id} />
            <input type="hidden" name="status" value="canceled" />
            <input
              type="hidden"
              name="returnTo"
              value={`/applications/${app.id}?back=${backEncoded}`}
            />
            <button className="w-full rounded border px-3 py-2 text-sm hover:bg-gray-50">
              Cancel
            </button>
          </form>
        </div>

        <div className="text-xs opacity-60">
          Conversion creates a Member + Membership after payment.
        </div>

        <Link
          href={`/applications/${app.id}/convert?back=${backEncoded}`}
          className="mt-2 inline-block w-full rounded border px-3 py-2 text-center text-sm hover:bg-gray-50"
        >
          Convert to Member
        </Link>
      </div>
    </div>
  );
}
