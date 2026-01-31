export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function ymd(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number) {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sumAmounts(rows: any[]) {
  return rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; q?: string; method?: string; preset?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const supabase = await createClient();

  const today = startOfToday();
  const todayStr = ymd(today);
  const defaultFrom = sp.from?.trim() || todayStr;
  const defaultTo = sp.to?.trim() || todayStr;

  const q = (sp.q ?? "").trim();
  const method = (sp.method ?? "").trim();
  const preset = (sp.preset ?? "").trim(); // "today" | "7d" | ""

  let from = defaultFrom;
  let to = defaultTo;

  if (preset === "today") {
    from = todayStr;
    to = todayStr;
  } else if (preset === "7d") {
    from = ymd(addDays(today, -6)); // inclusive 7 days including today
    to = todayStr;
  }

  // For date filtering on a DATE column:
  // - inclusive from: >= from
  // - inclusive to: <= to
  // Supabase doesn't have <= for date ranges easily with single function, so we use gte/lte.
  let paymentsQuery = supabase
    .from("payments")
    .select("id, amount, paid_on, payment_method, notes, created_at, member:members(id, full_name, phone)")
    .order("paid_on", { ascending: false })
    .limit(200);

  if (from) paymentsQuery = paymentsQuery.gte("paid_on", from);
  if (to) paymentsQuery = paymentsQuery.lte("paid_on", to);
  if (method) paymentsQuery = paymentsQuery.eq("payment_method", method);

  const { data: payments, error } = await paymentsQuery;

  // Client-side search (simple + reliable for MVP)
  const filteredPayments = (payments ?? []).filter((p: any) => {
    if (!q) return true;
    const name = (p.member?.full_name ?? "").toLowerCase();
    const phone = (p.member?.phone ?? "").toLowerCase();
    const qq = q.toLowerCase();
    return name.includes(qq) || phone.includes(qq);
  });

  const rangeTotal = sumAmounts(filteredPayments);

  // Totals for today / last 7 days (separate queries to avoid filter complexity)
  const { data: todayRows } = await supabase
    .from("payments")
    .select("amount")
    .eq("paid_on", todayStr);

  const { data: weekRows } = await supabase
    .from("payments")
    .select("amount")
    .gte("paid_on", ymd(addDays(today, -6)))
    .lte("paid_on", todayStr);

  const todayTotal = sumAmounts(todayRows ?? []);
  const weekTotal = sumAmounts(weekRows ?? []);

  const makeHref = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const fromV = next.from ?? from;
    const toV = next.to ?? to;
    const qV = next.q ?? q;
    const methodV = next.method ?? method;

    if (fromV) p.set("from", fromV);
    if (toV) p.set("to", toV);
    if (qV) p.set("q", qV);
    if (methodV) p.set("method", methodV);
    if (next.preset) p.set("preset", next.preset);

    return `/payments?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Payments</h1>
        <p className="text-sm opacity-70">Track collections and member payments</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link href={makeHref({ preset: "today", q: "", method: "" })} className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Today</div>
          <div className="text-lg font-semibold">${todayTotal.toFixed(2)}</div>
        </Link>

        <Link href={makeHref({ preset: "7d", q: "", method: "" })} className="rounded border p-3 hover:bg-gray-50">
          <div className="text-sm opacity-70">Last 7 days</div>
          <div className="text-lg font-semibold">${weekTotal.toFixed(2)}</div>
        </Link>
      </div>

      <div className="rounded border p-3 text-sm">
        <div className="font-medium">Selected range total</div>
        <div className="mt-1 text-lg font-semibold">${rangeTotal.toFixed(2)}</div>
        <div className="mt-1 text-xs opacity-70">
          Showing {filteredPayments.length} payment(s) for {from} → {to}
        </div>
      </div>

      <div className="flex gap-2">
        <Link
          href={makeHref({}).replace("/payments?", "/payments/export?")}
          className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
        >
          Export CSV
        </Link>
      </div>

      <form className="rounded border p-3 space-y-3" action="/payments" method="get">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs opacity-70">From</label>
            <input name="from" type="date" defaultValue={from} className="w-full rounded border px-3 py-2" />
          </div>
          <div className="space-y-1">
            <label className="text-xs opacity-70">To</label>
            <input name="to" type="date" defaultValue={to} className="w-full rounded border px-3 py-2" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs opacity-70">Search (name or phone)</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="e.g. John or 876-..."
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs opacity-70">Payment method</label>
          <select name="method" defaultValue={method} className="w-full rounded border px-3 py-2">
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button className="rounded border px-3 py-2 text-sm hover:bg-gray-50">Apply filters</button>
          <Link href="/payments" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
            Reset
          </Link>
        </div>

        <div className="flex gap-2">
          <Link href={makeHref({ preset: "today", q: "", method: "" })} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">
            Today
          </Link>
          <Link href={makeHref({ preset: "7d", q: "", method: "" })} className="rounded border px-3 py-1.5 text-xs hover:bg-gray-50">
            Last 7 days
          </Link>
        </div>
      </form>

      {error ? (
        <div className="rounded border p-3 text-sm">
          Could not load payments.
          <div className="mt-1 text-xs opacity-70">{error.message}</div>
        </div>
      ) : null}

      {!error && filteredPayments.length === 0 ? (
        <div className="rounded border p-3 text-sm opacity-70">No payments found for this filter.</div>
      ) : null}

      <div className="space-y-2">
        {filteredPayments.map((p: any) => (
          <div key={p.id} className="rounded border p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">${Number(p.amount).toFixed(2)}</div>
                <div className="text-sm opacity-70">Paid on: {p.paid_on}</div>
                {p.payment_method ? (
                  <div className="text-xs opacity-70">Method: {p.payment_method}</div>
                ) : null}
                {p.notes ? <div className="mt-1 text-xs opacity-70">{p.notes}</div> : null}
              </div>

              <div className="text-right">
                {p.member?.id ? (
                  <Link href={`/members/${p.member.id}`} className="text-sm underline underline-offset-2">
                    {p.member.full_name ?? "View member"}
                  </Link>
                ) : (
                  <div className="text-sm opacity-70">Member unknown</div>
                )}
                <div className="text-xs opacity-70">{p.member?.phone ?? ""}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
