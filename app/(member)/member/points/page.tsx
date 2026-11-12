import Link from "next/link";
export default function PointsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Rewards membership</h1>
      <p>
        Your membership provides the published discounts and perks on your
        Benefits page. Recorded visit points are activity history; a
        points-redemption programme is not currently offered in this app.
      </p>
      <Link href="/member/benefits" className="inline-block rounded border p-3">
        View usable benefits
      </Link>
    </div>
  );
}
