import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | Travellers Club",
  description: "How Travellers Club uses membership and sign-in information.",
};

export default function PrivacyPage() {
  return (
    <main id="main-content" tabIndex={-1} className="club-auth-main">
      <article className="mx-auto max-w-2xl space-y-7 pb-10 text-sm leading-relaxed">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          Travellers Club
        </Link>
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Your privacy</h1>
          <p className="text-muted-foreground">Updated 12 November 2026</p>
          <p>
            This notice covers Travellers Club, the membership, Rewards, gym,
            and resort-access app operated by Travellers Beach Resort in Negril,
            Jamaica.
          </p>
        </header>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Information used by the app</h2>
          <p>
            We use your name, email, account identifier, and any contact or
            profile details you provide to manage your membership. We also keep
            membership and pass details, purchase and payment references,
            facility-waiver records, verified gym visits, recorded benefit use,
            and staff activity relating to your account.
          </p>
          <p>
            Authentication cookies and browser storage keep you signed in.
            Technical request and security information is processed to operate
            and protect the service.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Signing in with Google</h2>
          <p>
            Google sign-in is optional. If you choose it, Google provides your
            account identifier, email and verification information, and basic
            profile information such as your name and profile picture. We use
            these details to authenticate you and connect you to your Club
            membership.
          </p>
          <p>
            The Club app does not request access to your Gmail messages,
            contacts, calendar, or Drive files. We do not use Google account
            information for advertising or sell it. Email sign-in remains
            available.
          </p>
          <p>
            You can remove the Google connection in your Google account
            settings. This does not automatically delete your Club membership or
            records; contact us if you also want those reviewed or deleted.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">
            How information is used and shared
          </h2>
          <p>
            We use membership information to issue your digital card, verify
            access and benefits, record visits and payments, provide account
            assistance, and protect the service. Authorized hotel staff can
            access information needed for their role. Signed-in gym rankings
            show member names or display labels, visit totals, and ranks.
          </p>
          <p>
            Service providers process information to deliver these functions:
            Supabase for authentication and database services, Vercel for app
            hosting, and Fygaro for online payment processing. Google processes
            Google sign-in under its own privacy policy. Online payment details
            are entered through the payment provider; the Club app keeps payment
            and transaction references.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Retention and your choices</h2>
          <p>
            Records are retained for membership administration, transaction
            reconciliation, security, and applicable recordkeeping obligations.
            An expired access pass does not automatically delete your free
            Rewards membership or visit history.
          </p>
          <p>
            You can update your name and optional phone number in My account.
            For access to your information, corrections, deletion, or questions
            about retention, contact the front desk. We verify your identity
            before making account changes. Some transaction or security records
            may need to be retained when an account is closed.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p>
            Travellers Beach Resort, Norman Manley Boulevard, Negril, Jamaica.
          </p>
          <p>
            Email{" "}
            <a href="mailto:tbr.frontdesk@gmail.com" className="underline">
              tbr.frontdesk@gmail.com
            </a>{" "}
            or speak to the hotel front desk about a Travellers Club privacy
            request.
          </p>
        </section>
      </article>
    </main>
  );
}
