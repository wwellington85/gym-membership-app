import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
async function findMember(
  admin: SupabaseClient,
  request: { user_id?: string | null; email?: string | null },
) {
  if (request.user_id) {
    const { data } = await admin
      .from("members")
      .select("id, full_name")
      .eq("user_id", request.user_id)
      .maybeSingle();
    if (data) return data;
  }
  if (request.email) {
    const { data } = await admin
      .from("members")
      .select("id, full_name")
      .eq("email", request.email.toLowerCase())
      .maybeSingle();
    return data;
  }
  return null;
}
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { passIsActive, type AccessPass } from "@/lib/access/rules";
export const dynamic = "force-dynamic";
export default async function ProcessRequest({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const { admin } = await requireStaff(["admin", "front_desk"]);
  const { applicationId } = await params;
  const sp = await searchParams;
  const { data: request } = await admin
    .from("membership_applications")
    .select(
      "id, full_name, phone, email, user_id, requested_plan_code, requested_start_date, status, converted_member_id",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (!request) notFound();
  const member = await findMember(admin, request);
  async function prepare() {
    "use server";
    const { admin } = await requireStaff(["admin", "front_desk"]);
    const { data: req } = await admin
      .from("membership_applications")
      .select("id,full_name,phone,email,user_id")
      .eq("id", applicationId)
      .single();
    if (!req) redirect("/applications");
    const found = await findMember(admin, req);
    if (found) redirect(`/members/${found.id}?request=${applicationId}`);
    const { data: id, error } = await admin.rpc("enrol_club_member", {
      p_name: req.full_name,
      p_phone: req.phone || "",
      p_email: req.email || null,
      p_key: applicationId,
    });
    if (error || !id)
      redirect(
        `/applications/${applicationId}/convert?err=Could%20not%20prepare%20member.%20Search%20existing%20records%20before%20retrying.`,
      );
    // Guest claims this identity through verified email sign-in; never create a
    // second Auth account or bypass identity verification from an old request.
    redirect(`/members/${id}?request=${applicationId}`);
  }
  async function resolve() {
    "use server";
    const { admin, user } = await requireStaff(["admin", "front_desk"]);
    const { data: req } = await admin
      .from("membership_applications")
      .select("email,user_id,requested_plan_code,requested_start_date")
      .eq("id", applicationId)
      .single();
    if (!req) redirect("/applications");
    const found = await findMember(admin, req);
    if (!found)
      redirect(
        `/applications/${applicationId}/convert?err=Prepare%20the%20member%20record%20first.`,
      );
    const { data: passes } = await admin
      .from("access_passes")
      .select("*")
      .eq("member_id", found.id)
      .eq("status", "active");
    if (
      req.requested_plan_code !== "rewards_free" &&
      !((passes as AccessPass[]) || []).some(
        (p) =>
          p.plan_snapshot.code === req.requested_plan_code &&
          (req.requested_start_date
            ? p.start_date <= req.requested_start_date &&
              p.paid_through_date >= req.requested_start_date
            : passIsActive(p)),
      )
    )
      redirect(
        `/applications/${applicationId}/convert?err=Sell%20the%20requested%20access%20and%20verify%20its%20dates%20before%20resolving.`,
      );
    const { error } = await admin
      .from("membership_applications")
      .update({
        status: "converted",
        converted_member_id: found.id,
        converted_at: new Date().toISOString(),
        converted_by: user.id,
      })
      .eq("id", applicationId);
    redirect(
      error
        ? `/applications/${applicationId}/convert?err=Could%20not%20resolve%20request.`
        : `/members/${found.id}?saved=1`,
    );
  }
  return (
    <div className="max-w-xl space-y-4">
      <Link href="/applications" className="inline-block py-2 underline">
        Back to requests
      </Link>
      <h1 className="text-xl font-semibold">Process access request</h1>
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      <div className="rounded border p-4">
        <p className="font-semibold">{request.full_name}</p>
        <p className="mt-2 text-sm">
          {request.requested_plan_code} · Requested start{" "}
          {request.requested_start_date || "Not supplied"}
        </p>
        <p className="mt-2 text-sm">Status: {request.status}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Use the member record to sell or renew the correct access product. Free
        Rewards signup does not require a pending application.
      </p>
      {member && (
        <Link
          href={`/members/${member.id}?request=${applicationId}`}
          className="inline-block rounded border p-3"
        >
          Open {member.full_name}
        </Link>
      )}
      <form action={prepare}>
        <button className="rounded border p-3">
          Find or create free member record
        </button>
      </form>
      <form action={resolve}>
        <button className="rounded border p-3">
          Confirm access is fulfilled & resolve request
        </button>
      </form>
    </div>
  );
}
