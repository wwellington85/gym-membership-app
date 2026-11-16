import Image from "next/image";
import Link from "next/link";
import { requireMember } from "@/lib/access/server";
export default async function Facilities() {
  await requireMember();
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Around Travellers</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Check your benefits for the facility access included with your
          membership.
        </p>
        <Link href="/member/benefits" className="club-text-link mt-3 text-sm">
          View my benefits →
        </Link>
      </header>
      <div className="club-hotel-grid">
        {[
          ["pool", "Poolside", "Take a little time to unwind."],
          ["gym", "Stay active", "Make time for your workout."],
          ["games-lounge", "Family games lounge", "Spend some time together."],
        ].map(([photo, title, caption]) => (
          <article key={photo}>
            <div className="club-hotel-photo">
              <Image
                src={`/images/hotel/${photo}.webp`}
                alt={`${title} at Travellers Beach Resort`}
                fill
                sizes="(max-width:640px) 45vw, 300px"
              />
            </div>
            <h2 className="mt-2 text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
          </article>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/member/dining" className="club-text-link">
          Restaurant menus →
        </Link>
        <Link href="/member/experiences?kind=cabana" className="club-text-link">
          Cabana rentals →
        </Link>
      </div>
    </div>
  );
}
