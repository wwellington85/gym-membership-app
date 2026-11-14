import Link from "next/link";
export default function HelpPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Membership help</h1>
      <section className="space-y-2">
        <h2 className="font-semibold">Your account and Local Rewards</h2>
        <p className="text-sm text-muted-foreground">
          Anyone can join for a free account, digital card and Club visit
          history. Free signup does not include discounts or facility access.
          Local Rewards discounts are approved by staff for selected community
          members; ask the front desk about eligibility. Weekly and monthly Club
          plans include their published access and discounts during the pass
          dates. Show your card before ordering and check outlet or event
          restrictions.
        </p>
        <Link href="/member/benefits" className="inline-block py-3 underline">
          View my benefits
        </Link>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Access and payments</h2>
        <p className="text-sm text-muted-foreground">
          Passes use Jamaica calendar dates and end at 10 pm on the last day. If
          payment is still confirming, do not pay again. Show the payment
          reference in My account to the front desk so staff can check it.
        </p>
        <Link href="/member/settings" className="inline-block py-3 underline">
          My account & purchases
        </Link>
      </section>
      <section className="space-y-2">
        <h2 className="font-semibold">Account and privacy requests</h2>
        <p className="text-sm text-muted-foreground">
          For a sign-in email change, an account deletion or data request, a
          benefit discrepancy, or booking assistance, contact the Travellers
          Beach Resort front desk. Staff will verify your identity before making
          account changes.
        </p>
      </section>
    </div>
  );
}
