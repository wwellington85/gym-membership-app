import { issueGiftAction, revokeGiftAction } from "./reward-actions";
import { giftStatus } from "@/lib/rewards/gifts";
import Link from "next/link";
import { randomUUID } from "crypto";
import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import {
  loadAccess,
  loadCatalogue,
  loadLocalRewards,
} from "@/lib/access/server";
import {
  formatMemberNumber,
  facilities,
  passIsActive,
} from "@/lib/access/rules";
import {
  addDaysYmd,
  jamaicaNowParts,
  jamaicaTodayYmd,
} from "@/lib/membership/status";
import { ExtendAccessForm } from "./ExtendAccessForm";
import { extendAccessAction } from "./extend-access";
import { ChangePlanForm } from "./ChangePlanForm";
import {
  setLocalRewardsAction,
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
    .select("id, member_number, full_name, phone, email, is_active")
    .eq("id", memberId)
    .maybeSingle();
  if (error || !member) notFound();
  const localRewards = await loadLocalRewards(member.id);
  const { data: gifts, error: giftError } = await admin
    .from("reward_gifts")
    .select("id, title, terms, valid_until, status, created_at, issue_reason")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const [access, catalogue, sp, ranking, points] = await Promise.all([
    loadAccess(member.id, member.is_active),
    loadCatalogue(true),
    searchParams,
    admin.rpc("member_leaderboard_summary", {
      p_member_id: member.id,
      p_period: "all",
    }),
    admin.rpc("club_visit_points", { p_member_id: member.id }),
  ]);
  const { data: extensions, error: extensionError } = await admin
    .from("access_pass_extensions")
    .select("id, pass_id, previous_end_date, new_end_date, reason, created_at")
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const today = jamaicaNowParts();
  const earliestEnd = today.hour >= 22 ? addDaysYmd(today.ymd, 1) : today.ymd;
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
            ? "Club account active"
            : "Membership inactive — benefits and access blocked"}
        </p>
        <p className="mt-2 break-all font-mono text-xs">
          {formatMemberNumber(member.member_number) ||
            "Membership number unavailable"}
        </p>
      </div>
      <section className="oura-card space-y-3 p-4">
        <h2 className="font-semibold">Club visits & progress</h2>
        <dl className="club-metrics">
          {[
            [
              "All-time rank",
              ranking.error
                ? "—"
                : ranking.data?.[0]?.my_rank
                  ? `#${ranking.data[0].my_rank}`
                  : "Unranked",
            ],
            [
              "Visits",
              ranking.error ? "—" : (ranking.data?.[0]?.my_checkins ?? 0),
            ],
            ["Points", points.error ? "—" : (points.data ?? 0)],
          ].map(([label, value]) => (
            <div key={label} className="club-metric">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {(ranking.error || points.error) && (
          <p role="status" className="text-sm">
            Some progress data is temporarily unavailable.
          </p>
        )}
        <Link href="/checkins/rankings" className="club-text-link">
          View Club rankings
        </Link>
      </section>
      {(sp.err || sp.member_error) && (
        <p role="alert" className="oura-alert-danger">
          {sp.err ||
            "Member details could not be updated. Please check the information and try again."}
        </p>
      )}
      {sp.extended && (
        <p role="status" className="oura-alert-success">
          Complimentary extension saved. The updated expiry is shown below; the
          original payment is unchanged.
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
          Verify benefits / record Club visit
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
      <section className="oura-card space-y-3 p-4">
        <h2 className="font-semibold">Local Rewards</h2>
        <p className="text-sm">
          {localRewards?.is_active
            ? "Approved · base outlet discounts enabled"
            : "Free account · no Local Rewards discounts"}
        </p>
        <p className="text-sm text-muted-foreground">
          For selected local residents, workers and community partners. Approval
          does not grant facility access. Paid pass benefits remain separate.
        </p>
        {localRewards && (
          <p className="text-sm text-muted-foreground">
            Last updated{" "}
            {new Date(localRewards.updated_at).toLocaleDateString("en-GB", {
              timeZone: "America/Jamaica",
            })}{" "}
            · {localRewards.reason}
          </p>
        )}
        <details>
          <summary className="cursor-pointer py-2 text-sm underline">
            {localRewards?.is_active
              ? "Remove Local Rewards"
              : "Activate Local Rewards"}
          </summary>
          <form action={setLocalRewardsAction} className="mt-2 space-y-3">
            <input type="hidden" name="member_id" value={member.id} />
            <input
              type="hidden"
              name="active"
              value={localRewards?.is_active ? "0" : "1"}
            />
            <label className="block text-sm" htmlFor="local-rewards-reason">
              Reason for {localRewards?.is_active ? "removal" : "approval"}
            </label>
            <textarea
              id="local-rewards-reason"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              className="oura-input w-full p-3"
              placeholder="For example: local resident, eligibility confirmed at front desk"
            />
            <button className="club-button-secondary">
              {localRewards?.is_active
                ? "Remove discounts"
                : "Approve Local Rewards"}
            </button>
          </form>
        </details>
      </section>
      <section className="oura-card space-y-3 p-4">
        <h2 className="font-semibold">Selected rewards</h2>
        <p className="text-sm text-muted-foreground">
          Issue a gift based on the member relationship. Points and
          paid/complimentary access do not automatically qualify anyone. No
          points are deducted for these gifts.
        </p>
        <Link href="/rewards/redeem" className="club-text-link">
          Scan a reward for fulfilment
        </Link>
        {sp.gift_saved && <p role="status">Reward updated.</p>}
        {giftError ? (
          <p role="alert">Reward history could not be loaded.</p>
        ) : (
          gifts?.map((g) => (
            <div key={g.id} className="border-t py-3 text-sm">
              <strong>{g.title}</strong>
              <p>
                {giftStatus(g)} · Through {g.valid_until}
              </p>
              <p>{g.terms}</p>
              <p className="text-muted-foreground">
                Staff reason: {g.issue_reason}
              </p>
              {staff.role === "admin" && g.status === "available" && (
                <details>
                  <summary className="cursor-pointer py-2">
                    Revoke unused gift
                  </summary>
                  <form action={revokeGiftAction} className="space-y-2">
                    <input type="hidden" name="member_id" value={member.id} />
                    <input type="hidden" name="gift_id" value={g.id} />
                    <label htmlFor={`gift-reason-${g.id}`}>Reason</label>
                    <input
                      id={`gift-reason-${g.id}`}
                      name="reason"
                      required
                      minLength={3}
                      maxLength={500}
                      className="oura-input w-full p-3"
                    />
                    <button className="club-button-secondary">
                      Revoke gift
                    </button>
                  </form>
                </details>
              )}
            </div>
          ))
        )}
        {staff.role === "admin" && member.is_active && (
          <details>
            <summary className="cursor-pointer py-2">
              Issue a reward gift
            </summary>
            <form action={issueGiftAction} className="space-y-3">
              <input type="hidden" name="member_id" value={member.id} />
              <input type="hidden" name="submission_key" value={randomUUID()} />
              <label className="block" htmlFor="gift-title">
                Reward / selected item
              </label>
              <input
                id="gift-title"
                name="title"
                required
                minLength={3}
                maxLength={120}
                placeholder="One selected cocktail or mocktail"
                className="oura-input w-full p-3"
              />
              <label className="block" htmlFor="gift-category">
                Category
              </label>
              <select
                id="gift-category"
                name="category"
                className="oura-input w-full p-3"
              >
                <option value="treat">Treat</option>
                <option value="quarterly_meal">
                  Quarterly meal (one per member per quarter)
                </option>
                <option value="other">Other gift</option>
              </select>
              <label className="block" htmlFor="gift-terms">
                Member-facing terms / selected menu items
              </label>
              <textarea
                id="gift-terms"
                name="terms"
                maxLength={1000}
                className="oura-input w-full p-3"
              />
              <label className="block" htmlFor="gift-expiry">
                Use by (10 pm)
              </label>
              <input
                id="gift-expiry"
                name="valid_until"
                type="date"
                required
                min={earliestEnd}
                defaultValue={addDaysYmd(today.ymd, 30)}
                className="oura-input w-full p-3"
              />
              <label className="block" htmlFor="gift-issue-reason">
                Staff approval reason (private)
              </label>
              <textarea
                id="gift-issue-reason"
                name="reason"
                required
                minLength={3}
                maxLength={500}
                className="oura-input w-full p-3"
              />
              <button className="club-button-secondary">
                Issue complimentary gift
              </button>
            </form>
          </details>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Access passes</h2>
        {extensionError && (
          <p role="status" className="text-sm">
            Extension history could not be loaded. Current pass expiration dates
            are shown below.
          </p>
        )}
        {!access.passes.length && (
          <p className="text-sm text-muted-foreground">
            No access passes. Rewards membership remains separate.
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
            {extensions
              ?.filter((e) => e.pass_id === p.id)
              .map((e) => (
                <p key={e.id} className="mt-2 text-sm text-muted-foreground">
                  Complimentary extension: {e.previous_end_date} →{" "}
                  {e.new_end_date} ·{" "}
                  {new Date(e.created_at).toLocaleDateString("en-GB", {
                    timeZone: "America/Jamaica",
                  })}{" "}
                  · {e.reason}
                </p>
              ))}
            {staff.role === "admin" &&
              member.is_active &&
              p.status === "active" &&
              p.paid_through_date < "9999-12-31" && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer py-2">
                    Extend access
                  </summary>
                  <ExtendAccessForm
                    action={extendAccessAction}
                    memberId={member.id}
                    passId={p.id}
                    currentEnd={p.paid_through_date}
                    minEnd={
                      addDaysYmd(p.paid_through_date, 1) > earliestEnd
                        ? addDaysYmd(p.paid_through_date, 1)
                        : earliestEnd
                    }
                    submissionKey={randomUUID()}
                  />
                </details>
              )}
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
          <h2 className="font-semibold">Grant, sell or renew access</h2>
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
          <p className="text-sm text-muted-foreground">
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
