import { PushSettings } from "@/components/rewards/push-settings";
import { cookies } from "next/headers";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access/server";

export const dynamic = "force-dynamic";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    saved?: string;
    preference_saved?: string;
    err?: string;
  }>;
}) {
  const { member, admin } = await requireMember();
  const sp = await searchParams;
  const editing = sp.edit === "1";
  const { data: payments, error } = await admin
    .from("payments")
    .select(
      "id, amount, currency, status, fulfilled_at, created_at, purchased_plan_id, purchase_snapshot, access_start_date, access_end_date, provider, payment_method",
    )
    .eq("member_id", member.id)
    .order("created_at", { ascending: false })
    .limit(30);
  async function save(data: FormData) {
    "use server";
    const { member, admin } = await requireMember();
    const name = String(data.get("full_name") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    if (!name || name.length > 120 || phone.length > 40)
      redirect(
        "/member/settings?edit=1&err=Please%20check%20your%20name%20and%20phone.",
      );
    const { error } = await admin
      .from("members")
      .update({ full_name: name, phone })
      .eq("id", member.id);
    redirect(
      error
        ? "/member/settings?edit=1&err=Could%20not%20save.%20Please%20try%20again."
        : "/member/settings?saved=1",
    );
  }
  async function logout() {
    "use server";
    const { supabase, admin, member } = await requireMember();
    const jar = await cookies();
    const device = jar.get("club_push_device")?.value;
    if (device) {
      const { error } = await admin
        .from("push_subscriptions")
        .delete()
        .eq("id", device)
        .eq("member_id", member.id);
      if (error)
        redirect(
          "/member/settings?err=Could%20not%20turn%20off%20device%20alerts.%20Please%20retry%20signing%20out.",
        );
      jar.delete("club_push_device");
    }
    await supabase.auth.signOut();
    redirect("/auth/login");
  }
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Your account.</h1>
      {sp.saved && (
        <p role="status" className="oura-alert-success">
          Your details were saved.
        </p>
      )}
      {sp.preference_saved && (
        <p role="status" className="oura-alert-success">
          Your starting screen was saved.
        </p>
      )}
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      <section
        id="account-details"
        className="space-y-4 scroll-mt-5"
        aria-labelledby="account-details-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="account-details-heading" className="font-semibold">
            Personal details
          </h2>
          {!editing && (
            <Link
              href="/member/settings?edit=1#account-details"
              className="club-text-link min-h-11 text-sm"
              aria-label="Edit account details"
            >
              <Pencil size={15} aria-hidden="true" />
              Edit
            </Link>
          )}
        </div>
        {editing ? (
          <form action={save} className="space-y-4">
            <div>
              <label htmlFor="account-name" className="text-sm">
                Full name
              </label>
              <input
                id="account-name"
                name="full_name"
                autoComplete="name"
                required
                maxLength={120}
                defaultValue={member.full_name}
                className="oura-input mt-2 w-full p-3"
              />
            </div>
            <div>
              <label htmlFor="account-phone" className="text-sm">
                Phone (optional)
              </label>
              <input
                id="account-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
                defaultValue={member.phone || ""}
                className="oura-input mt-2 w-full p-3"
              />
            </div>
            <p className="break-words text-sm text-muted-foreground">
              Sign-in email: {member.email}. Contact the front desk if you need
              to change it.
            </p>
            <div className="flex flex-wrap gap-3">
              <button className="club-button">Save details</button>
              <Link
                href="/member/settings#account-details"
                className="club-button-secondary"
              >
                Cancel
              </Link>
            </div>
          </form>
        ) : (
          <>
            <dl className="divide-y divide-border border-y border-border">
              <div className="py-4">
                <dt className="text-xs text-muted-foreground">Full name</dt>
                <dd className="mt-1 break-words text-sm">{member.full_name}</dd>
              </div>
              <div className="py-4">
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="mt-1 text-sm">
                  {member.phone || "Not provided"}
                </dd>
              </div>
              <div className="py-4">
                <dt className="text-xs text-muted-foreground">Sign-in email</dt>
                <dd className="mt-1 break-all text-sm">{member.email}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">
              Contact the front desk if you need to change your sign-in email.
            </p>
          </>
        )}
      </section>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/member/bookings"
          className="rounded border px-3 py-3 text-sm"
        >
          My cabana & dinner bookings
        </Link>
        <Link
          href="/auth/update-password"
          className="rounded border px-3 py-3 text-sm"
        >
          Change password
        </Link>
        <Link href="/member/help" className="rounded border px-3 py-3 text-sm">
          Help & membership information
        </Link>
      </div>
      <PushSettings />
      <section className="space-y-3">
        <h2 className="font-semibold">Recent purchases</h2>
        {error ? (
          <p role="alert">We could not load purchases. Please try again.</p>
        ) : !payments?.length ? (
          <p className="text-sm text-muted-foreground">No purchases yet.</p>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="rounded border p-3 text-sm">
              <h3 className="font-medium">
                {p.purchase_snapshot?.name || "Membership payment"}
              </h3>
              <p className="mt-2">
                {["complimentary", "comp"].includes(p.payment_method) ? (
                  "Complimentary pass"
                ) : (
                  <>
                    {"$"}
                    {Number(p.amount).toFixed(2)} {p.currency || "USD"} ·{" "}
                    {p.status || "Recorded at desk"}
                  </>
                )}
                {p.status === "paid" && p.purchased_plan_id
                  ? p.fulfilled_at
                    ? " · Access activated"
                    : " · Activation needs review"
                  : ""}
              </p>
              {p.access_start_date && (
                <p className="mt-2">
                  {p.access_start_date} — {p.access_end_date}
                </p>
              )}
              <p className="mt-2 break-all text-xs text-muted-foreground">
                Reference: {p.id}
              </p>
              {p.provider === "fygaro" && (
                <Link
                  className="inline-block py-3 underline"
                  href={`/member/payment-return?payment=${p.id}`}
                >
                  Check payment status
                </Link>
              )}
            </div>
          ))
        )}
      </section>
      <form action={logout}>
        <button className="w-full rounded border px-4 py-3">Log out</button>
      </form>
    </div>
  );
}
