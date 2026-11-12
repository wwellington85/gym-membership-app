import Link from "next/link";
import { randomUUID } from "crypto";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { loadAccess, loadCatalogue } from "@/lib/access/server";
import { memberNumber, facilities, passIsActive } from "@/lib/access/rules";
import { jamaicaTodayYmd } from "@/lib/membership/status";
import { ChangePlanForm } from "./ChangePlanForm";
import {
  changeMemberPlanAction,
  setMemberActiveAction,
  updateMemberContactAction,
  sendMemberLoginDetailsAction,
} from "./actions";
export const dynamic = "force-dynamic";
export default async function MemberProfile({
  params,
  searchParams,
}: {
  params: Promise<{ memberId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { admin, staff } = await requireStaff();
  const { memberId } = await params;
  if (staff.role === "security") redirect(`/checkins/scan?member=${memberId}`);
  const { data: member, error } = await admin
    .from("members")
    .select("id, full_name, phone, email, is_active")
    .eq("id", memberId)
    .maybeSingle();
  if (error || !member) notFound();
  const [access, catalogue, sp] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(true),
    searchParams,
  ]);
  const { data: payments, error: paymentError } = await admin
    .from("payments")
    .select(
      "id, amount, currency, status, fulfilled_at, created_at, payment_method, purchase_snapshot",
    )
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(20);
  async function revoke(data: FormData) {
    "use server";
    const { admin, user } = await requireStaff(["admin"]);
    const reason = String(data.get("reason") || "").trim();
    if (reason.length < 3)
      redirect(
        `/members/${memberId}?err=Give%20a%20reason%20for%20revoking%20access.`,
      );
    const { error } = await admin.rpc("revoke_access_pass", {
      p_pass_id: String(data.get("pass_id") || ""),
      p_member_id: memberId,
      p_staff_id: user.id,
      p_reason: reason,
    });
    redirect(
      `/members/${memberId}?${error ? "err=Could%20not%20revoke%20access." : "saved=1"}`,
    );
  }
  return (
    <div className="space-y-5">
      <div>
        <Link href="/members" className="inline-block py-2 text-sm underline">
          Back to members
        </Link>
        <h1 className="text-2xl font-semibold">{member.full_name}</h1>
        <p className="mt-2 text-sm">
          {member.is_active
            ? "Rewards membership active"
            : "Membership inactive — benefits and access blocked"}
        </p>
        <p className="mt-2 break-all font-mono text-xs">
          {memberNumber(member.id)}
        </p>
      </div>
      {(sp.err || sp.member_error) && (
        <p role="alert" className="oura-alert-danger">
          {sp.err ||
            "Member details could not be updated. Please check the information and try again."}
        </p>
      )}
      {(sp.saved || sp.member_saved || sp.payment === "saved") && (
        <p role="status" className="oura-alert-success">
          Saved successfully. Review the updated record below.
        </p>
      )}
      {sp.member_reset === "sent" && (
        <p role="status" className="oura-alert-success">
          Login email sent.
        </p>
      )}
      {sp.request && /^[0-9a-f-]{36}$/i.test(sp.request) && (
        <Link
          href={`/applications/${sp.request}/convert`}
          className="inline-block rounded border p-3"
        >
          Return to access request
        </Link>
      )}
      <div className="flex flex-wrap gap-3">
        <Link
          className="rounded border p-3 text-sm"
          href={`/checkins/scan?member=${member.id}`}
        >
          Verify benefits / record gym visit
        </Link>
        <form action={sendMemberLoginDetailsAction}>
          <input type="hidden" name="member_id" value={member.id} />
          <button
            disabled={!member.email}
            className="rounded border p-3 text-sm disabled:opacity-50"
          >
            Send login link
          </button>
        </form>
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold">Access passes</h2>
        {!access.passes.length && (
          <p className="text-sm opacity-80">
            No paid access. Rewards membership remains separate.
          </p>
        )}
        {access.passes.map((p) => (
          <div key={p.id} className="rounded border p-4">
            <h3 className="font-semibold">{p.plan_snapshot.name}</h3>
            <p className="mt-2 text-sm">
              {p.status === "revoked"
                ? "Revoked"
                : !member.is_active
                  ? "Blocked — member inactive"
                  : passIsActive(p)
                    ? "Valid now"
                    : p.start_date > jamaicaTodayYmd()
                      ? "Upcoming"
                      : "Ended"}{" "}
              · {p.start_date} — {p.paid_through_date}
            </p>
            <p className="mt-2 text-sm">
              {facilities(p.plan_snapshot).join(" · ")} · 10 pm Jamaica cutoff.
            </p>
            {staff.role === "admin" && p.status === "active" && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer py-2">
                  Revoke this pass
                </summary>
                <form action={revoke} className="space-y-2">
                  <input type="hidden" name="pass_id" value={p.id} />
                  <label htmlFor={`reason-${p.id}`}>
                    Reason (does not issue a refund)
                  </label>
                  <input
                    id={`reason-${p.id}`}
                    name="reason"
                    minLength={3}
                    required
                    className="oura-input w-full p-3"
                  />
                  <button className="rounded border p-3">
                    Confirm revocation
                  </button>
                </form>
              </details>
            )}
          </div>
        ))}
      </section>
      {member.is_active && (
        <section className="oura-card space-y-3 p-4">
          <h2 className="font-semibold">Sell or renew access</h2>
          <ChangePlanForm
            memberId={member.id}
            plans={catalogue.filter((p) => p.grants_access)}
            passes={access.passes}
            checkoutKey={randomUUID()}
            today={jamaicaTodayYmd()}
            action={changeMemberPlanAction}
          />
        </section>
      )}
      <section className="space-y-3">
        <h2 className="font-semibold">Contact information</h2>
        <form action={updateMemberContactAction} className="space-y-3">
          <input type="hidden" name="member_id" value={member.id} />
          <div>
            <label htmlFor="contact-phone">Phone</label>
            <input
              id="contact-phone"
              type="tel"
              name="phone"
              defaultValue={member.phone || ""}
              className="oura-input mt-2 w-full p-3"
            />
          </div>
          <div>
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              defaultValue={member.email || ""}
              className="oura-input mt-2 w-full p-3"
            />
          </div>
          <p className="text-sm opacity-80">
            Verify the guest’s identity before changing their sign-in email.
          </p>
          <button className="rounded border p-3">Save contact details</button>
        </form>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Recent payments</h2>
        {paymentError ? (
          <p role="alert">Could not load payments.</p>
        ) : (
          payments?.map((p) => (
            <div key={p.id} className="rounded border p-3 text-sm">
              <p>
                {p.purchase_snapshot?.name || "Recorded payment"} · $
                {Number(p.amount).toFixed(2)} {p.currency || "USD"}
              </p>
              <p className="mt-2">
                {p.status || "Recorded at desk"} ·{" "}
                {p.fulfilled_at
                  ? "Access fulfilled"
                  : "No access fulfilment attached"}{" "}
                · {p.payment_method || "Online pending"}
              </p>
              <p className="mt-2 break-all text-xs">Reference {p.id}</p>
            </div>
          ))
        )}
        <Link
          href={`/members/${member.id}/add-payment`}
          className="inline-block py-3 underline"
        >
          Record an existing payment only (does not grant access)
        </Link>
      </section>
      {staff.role === "admin" && (
        <section className="rounded border p-4">
          <h2 className="font-semibold">Member status</h2>
          <p className="mt-2 text-sm">
            Deactivation blocks benefit verification and access. It does not
            merge records or refund purchases.
          </p>
          <form action={setMemberActiveAction} className="mt-3">
            <input type="hidden" name="member_id" value={member.id} />
            <input
              type="hidden"
              name="next_active"
              value={member.is_active ? "0" : "1"}
            />
            <button className="rounded border p-3">
              {member.is_active ? "Deactivate member" : "Reactivate member"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
