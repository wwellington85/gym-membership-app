import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { admin, staff } = await requireStaff();
  if (staff.role === "security") redirect("/checkins/scan");
  const { data, error } = await admin.rpc("club_overview");
  const metrics = [
    [
      "benefit_uses_30d",
      "Benefit uses (last 30 days)",
      staff.role === "admin" ? "/settings/programme-log" : "/members",
    ],
    [
      "returning_benefit_members",
      "Members using benefits on multiple days (30 days)",
      "/members",
    ],
    ["members", "Active Rewards members", "/members"],
    ["access", "Members with access valid now", "/members?filter=access"],
    ["rewards_only", "Rewards only", "/members?filter=rewards"],
    ["visits_today", "Club visits today", "/checkins"],
    ["pending_requests", "Requests to review", "/applications"],
    ["pending_payments", "Pending payments", "/payments?status=pending"],
    [
      "activation_review",
      "Paid — activation needs review",
      "/payments?status=needs_review",
    ],
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Club overview</h1>
      <p className="text-sm text-muted-foreground">
        Rewards membership and facility access are separate. Valid access
        includes passes ending soon.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/checkins/scan" className="rounded border bg-secondary p-3">
          Verify member
        </Link>
        <Link href="/members" className="rounded border p-3">
          Find member
        </Link>
        <Link href="/checkins/rankings" className="rounded border p-3">
          Club rankings
        </Link>
        <Link href="/applications" className="rounded border p-3">
          Review requests
        </Link>
      </div>
      {error ? (
        <p role="alert">
          We could not load the overview. Service tools remain available above.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([key, label, href]) => (
            <Link key={key} href={href} className="rounded border p-4">
              <h2 className="text-sm text-muted-foreground">{label}</h2>
              <p className="mt-3 text-3xl font-semibold">{data?.[key] ?? 0}</p>
            </Link>
          ))}
        </div>
      )}
      <section className="rounded border p-4 text-sm">
        <h2 className="font-semibold">Programme reporting</h2>
        <p className="mt-2 text-muted-foreground">
          These are operational counts, not proof of repeat hotel business.
          Benefit-use and booking attribution require a defined programme and
          connected booking/outlet data.
        </p>
      </section>
    </div>
  );
}
