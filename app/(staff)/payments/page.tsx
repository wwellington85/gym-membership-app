import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
export const dynamic = "force-dynamic";
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { admin } = await requireStaff(["admin", "front_desk"]);
  const sp = await searchParams;
  const query = String(sp.q || "").slice(0, 120);
  const status = ["all", "pending", "paid", "needs_review", "failed"].includes(
    sp.status || "",
  )
    ? sp.status!
    : "all";
  const page = Math.max(0, Math.floor(Number(sp.page) || 0));
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to! : "";
  const { data: rows, error } = await admin.rpc("search_club_payments", {
    p_query: query,
    p_status: status,
    p_from: from || null,
    p_to: to || null,
    p_page: page,
    p_size: 50,
  });
  const href = (overrides: Record<string, string>) =>
    `/payments?${new URLSearchParams({ q: query, status, from, to, ...overrides })}`;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Payments & activation</h1>
      <form className="grid gap-3 md:grid-cols-4">
        <div>
          <label htmlFor="payment-q" className="text-sm">
            Member or payment reference
          </label>
          <input
            id="payment-q"
            name="q"
            defaultValue={query}
            className="oura-input mt-2 w-full p-3"
          />
        </div>
        <div>
          <label htmlFor="payment-status" className="text-sm">
            Status
          </label>
          <select
            id="payment-status"
            name="status"
            defaultValue={status}
            className="oura-input mt-2 w-full p-3"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid / recorded</option>
            <option value="needs_review">Paid — activation needs review</option>
            <option value="failed">Failed / cancelled</option>
          </select>
        </div>
        <div>
          <label htmlFor="payment-from" className="text-sm">
            From
          </label>
          <input
            id="payment-from"
            name="from"
            type="date"
            defaultValue={from}
            className="oura-input mt-2 w-full p-3"
          />
        </div>
        <div>
          <label htmlFor="payment-to" className="text-sm">
            To
          </label>
          <input
            id="payment-to"
            name="to"
            type="date"
            defaultValue={to}
            className="oura-input mt-2 w-full p-3"
          />
        </div>
        <button className="rounded border p-3">Apply filters</button>
      </form>
      <Link
        href={`/payments/export?${new URLSearchParams({ q: query, status, from, to })}`}
        className="inline-block rounded border p-3 text-sm"
      >
        Export filtered payments (up to 5,000)
      </Link>
      {error ? (
        <p role="alert" className="oura-alert-danger">
          Could not load payments. Check date filters and try again.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {rows?.[0]?.total ?? 0} matching payments. Recording a payment alone
            does not grant or extend access.
          </p>
          <div className="space-y-2">
            {rows?.map((p: any) => (
              <Link
                key={p.id}
                href={`/members/${p.member_id}`}
                className="block rounded border p-4"
              >
                <div className="flex justify-between gap-3">
                  <h2 className="font-semibold">{p.full_name}</h2>
                  <span>
                    ${Number(p.amount).toFixed(2)} {p.currency}
                  </span>
                </div>
                <p className="mt-2 text-sm">
                  {p.status || "Recorded at desk"} ·{" "}
                  {p.provider === "fygaro" &&
                  p.status === "paid" &&
                  !p.fulfilled_at
                    ? "Activation needs review"
                    : p.fulfilled_at
                      ? "Access activated"
                      : "No access fulfilment attached"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {p.payment_method || p.provider || "Unspecified method"} ·{" "}
                  {p.created_at
                    ? new Date(p.created_at).toLocaleString("en-US", {
                        timeZone: "America/Jamaica",
                      })
                    : ""}
                </p>
                <p className="mt-2 break-all text-xs">Reference {p.id}</p>
              </Link>
            ))}
          </div>
          <div className="flex justify-between">
            {page > 0 ? (
              <Link
                className="rounded border p-3"
                href={href({ page: String(page - 1) })}
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            {(page + 1) * 50 < Number(rows?.[0]?.total || 0) && (
              <Link
                className="rounded border p-3"
                href={href({ page: String(page + 1) })}
              >
                Next
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
