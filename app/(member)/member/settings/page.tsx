import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access/server";

export const dynamic = "force-dynamic";
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; err?: string }>;
}) {
  const { member, admin } = await requireMember();
  const sp = await searchParams;
  const { data: payments, error } = await admin
    .from("payments")
    .select(
      "id, amount, currency, status, fulfilled_at, created_at, purchased_plan_id, purchase_snapshot, access_start_date, access_end_date, provider",
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
        "/member/settings?err=Please%20check%20your%20name%20and%20phone.",
      );
    const { error } = await admin
      .from("members")
      .update({ full_name: name, phone })
      .eq("id", member.id);
    redirect(
      error
        ? "/member/settings?err=Could%20not%20save.%20Please%20try%20again."
        : "/member/settings?saved=1",
    );
  }
  async function logout() {
    "use server";
    const { supabase } = await requireMember();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">My account</h1>
      {sp.saved && (
        <p role="status" className="oura-alert-success">
          Your details were saved.
        </p>
      )}
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      <form action={save} className="space-y-3">
        <div>
          <label htmlFor="account-name">Full name</label>
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
          <label htmlFor="account-phone">Phone (optional)</label>
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
        <p className="text-sm opacity-80">
          Sign-in email: {member.email}. Contact the front desk if you need to
          change it.
        </p>
        <button className="rounded border px-4 py-3">Save details</button>
      </form>
      <div className="flex flex-wrap gap-3">
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
      <section className="space-y-3">
        <h2 className="font-semibold">Recent purchases</h2>
        {error ? (
          <p role="alert">We could not load purchases. Please try again.</p>
        ) : !payments?.length ? (
          <p className="text-sm opacity-80">No purchases yet.</p>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="rounded border p-3 text-sm">
              <h3 className="font-medium">
                {p.purchase_snapshot?.name || "Membership payment"}
              </h3>
              <p className="mt-2">
                ${Number(p.amount).toFixed(2)} {p.currency || "USD"} ·{" "}
                {p.status || "Recorded at desk"}
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
              <p className="mt-2 break-all text-xs opacity-80">
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
