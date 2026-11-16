import Image from "next/image";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/access/server";
import {
  loadBookingCatalogue,
  loadCabanaAvailability,
} from "@/lib/bookings/server";
import { jamaicaTodayYmd, addDaysYmd } from "@/lib/membership/status";
import { MemberBooking } from "@/components/bookings/member-booking";
import { requestExperience } from "./actions";
export const dynamic = "force-dynamic";
export default async function Experiences({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; date?: string; err?: string }>;
}) {
  const { member } = await requireMember();
  const q = await searchParams;
  const dinner = q.kind === "dinner";
  const today = jamaicaTodayYmd();
  const date =
    q.date &&
    /^\d{4}-\d{2}-\d{2}$/.test(q.date) &&
    Number.isFinite(Date.parse(q.date)) &&
    q.date >= today &&
    q.date <= addDaysYmd(today, 365)
      ? q.date
      : dinner
        ? addDaysYmd(today, 1)
        : today;
  const [products, availability] = await Promise.all([
    loadBookingCatalogue(),
    loadCabanaAvailability(date),
  ]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {dinner ? "Starlight Dinner" : "Your private cabana"}
        </h1>
        <Link className="club-text-link" href="/member/bookings">
          My bookings
        </Link>
      </div>
      <div className="relative h-52 overflow-hidden rounded-2xl">
        <Image
          src={
            dinner
              ? "/images/experiences/starlight.webp"
              : "/images/experiences/cabanas.webp"
          }
          alt={
            dinner
              ? "A private table by the sea at sunset"
              : "Poolside cabanas at Travellers"
          }
          fill
          sizes="(max-width:640px) 100vw, 640px"
          className="object-cover"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {dinner
          ? "A private beach dinner for two. Request your date at least 24 hours ahead and choose your menu."
          : "Settle in by the pool with attentive service, a cooling mist fan and four hours to unwind."}
      </p>
      <nav
        className="grid min-w-0 grid-cols-2 gap-2 text-sm"
        aria-label="Experience type"
      >
        <Link
          href="/member/experiences?kind=cabana"
          aria-current={!dinner ? "page" : undefined}
          className={`rounded-xl border px-3 py-3 text-center font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${!dinner ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-primary hover:bg-muted"}`}
        >
          Cabana rentals
        </Link>
        <Link
          href="/member/experiences?kind=dinner"
          aria-current={dinner ? "page" : undefined}
          className={`rounded-xl border px-3 py-3 text-center font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${dinner ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white text-primary hover:bg-muted"}`}
        >
          Starlight Dinner
        </Link>
      </nav>
      {q.err && (
        <p role="alert" className="oura-alert-warning">
          {q.err}
        </p>
      )}
      {!member.is_active ? (
        <p>Please contact the front desk to arrange a booking.</p>
      ) : (
        <>
          <MemberBooking
            key={`${date}:${dinner}`}
            products={products.filter((p) =>
              dinner ? p.code === "starlight" : p.code.startsWith("cabana_"),
            )}
            date={date}
            today={today}
            maxDate={addDaysYmd(today, 365)}
            dinner={dinner}
            {...availability}
            submissionKey={randomUUID()}
            action={requestExperience}
            now={Date.now()}
          />
        </>
      )}
    </div>
  );
}
