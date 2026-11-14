import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ScanLine,
  Search,
  UserPlus,
  CalendarCheck,
  Trophy,
} from "lucide-react";
import { requireStaff } from "@/lib/auth/staff";
export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const { admin, staff } = await requireStaff();
  if (staff.role === "security") redirect("/checkins/scan");
  const { data, error } = await admin.rpc("club_overview");
  const bookingQueue = await admin
    .from("experience_bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "requested");
  const metric = (key: string) => (error ? "—" : (data?.[key] ?? 0));
  return (
    <div className="space-y-6" data-club-staff-ready>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="club-eyebrow">
            {staff.role === "admin"
              ? "Management"
              : staff.role === "supervisor"
                ? "Supervisor"
                : "Front desk"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">
            {staff.role === "admin" ? "Club overview" : "Member service"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Check in a member, verify their access, or help with their
            membership.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en-GB", {
            timeZone: "America/Jamaica",
            weekday: "long",
            day: "numeric",
            month: "short",
          })}
        </p>
      </header>
      <section
        className="club-staff-service"
        aria-labelledby="staff-service-heading"
      >
        <div>
          <h2 id="staff-service-heading" className="text-lg font-semibold">
            Ready for the next member
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Scan their card to check access and record a Club visit.
          </p>
          <Link href="/checkins/scan" className="club-button mt-4">
            <ScanLine size={20} aria-hidden="true" /> Check in / verify member
          </Link>
        </div>
        <form action="/members" className="space-y-2">
          <label
            htmlFor="staff-member-search"
            className="block text-sm font-semibold"
          >
            Find a member
          </label>
          <p
            id="staff-member-search-help"
            className="text-xs text-muted-foreground"
          >
            Search by name, email, phone or membership number.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              id="staff-member-search"
              name="q"
              type="search"
              className="oura-input min-w-0 flex-1 px-3 py-2"
              placeholder="Name or membership number"
              aria-describedby="staff-member-search-help"
              required
            />
            <button className="club-button-secondary">
              <Search size={18} aria-hidden="true" /> Search
            </button>
          </div>
        </form>
      </section>
      <nav
        aria-label="Member service shortcuts"
        className="flex flex-wrap gap-3"
      >
        {[
          ["/members/new", "Register member", UserPlus],
          ["/bookings", "Cabanas & dinner", CalendarCheck],
          ["/checkins", "Visit history", CalendarCheck],
          ["/checkins/rankings", "Club rankings", Trophy],
        ].map(([href, label, Icon]) => {
          const ShortcutIcon = Icon as typeof UserPlus;
          return (
            <Link
              key={String(href)}
              href={String(href)}
              className="club-button-secondary"
            >
              <ShortcutIcon size={18} aria-hidden="true" />
              {String(label)}
            </Link>
          );
        })}
      </nav>
      {error && (
        <p role="alert" className="oura-alert-warning">
          Summary counts are temporarily unavailable. Member service tools
          remain available above.
        </p>
      )}
      <section className="space-y-3" aria-labelledby="staff-attention-heading">
        <h2 id="staff-attention-heading" className="text-lg font-semibold">
          Needs attention
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/bookings" className="club-staff-attention">
            <div>
              <p className="text-sm font-medium">Cabana & dinner requests</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {bookingQueue.error ? "—" : (bookingQueue.count ?? 0)}
              </p>
            </div>
            <span className="club-text-link text-sm">
              Review bookings <ArrowRight size={16} aria-hidden="true" />
            </span>
          </Link>
          {[
            [
              "pending_requests",
              "Membership requests",
              "Review requests",
              "/applications",
            ],
            [
              "activation_review",
              "Paid access to review",
              "Review activation",
              "/payments?status=needs_review",
            ],
          ].map(([key, label, action, href]) => (
            <Link key={key} href={href} className="club-staff-attention">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {metric(key)}
                </p>
              </div>
              <span className="club-text-link text-sm">
                {action}
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="staff-today-heading">
        <h2 id="staff-today-heading" className="text-lg font-semibold">
          Club at a glance
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["visits_today", "Visits today", "/checkins"],
            ["members", "Active members", "/members"],
            ["access", "With facility access", "/members?filter=access"],
            ["rewards_only", "No facility pass", "/members?filter=rewards"],
          ].map(([key, label, href]) => (
            <Link key={key} href={href} className="rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {metric(key)}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer font-semibold">
          Programme activity
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            ["benefit_uses_30d", "Benefit uses · last 30 days"],
            [
              "returning_benefit_members",
              "Members using benefits on multiple days · last 30 days",
            ],
            ["pending_payments", "Pending checkout attempts"],
          ].map(([key, label]) => (
            <div key={key}>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">
                {metric(key)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Pending checkout attempts are not confirmed payments.
        </p>
        <Link
          href="/payments?status=pending"
          className="club-text-link mt-3 text-sm"
        >
          View payment attempts <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </details>
    </div>
  );
}
