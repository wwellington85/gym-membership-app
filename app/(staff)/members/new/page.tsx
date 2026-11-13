import Link from "next/link";
import { randomUUID } from "crypto";
import { requireStaff } from "@/lib/auth/staff";
import { createMember } from "./actions";
export default async function NewMemberPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  await requireStaff(["admin", "front_desk"]);
  const sp = await searchParams;
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-xl font-semibold">Add Rewards member</h1>
      <p className="text-sm text-muted-foreground">
        Create the free membership first. Sell optional gym or resort access
        from the member record.
      </p>
      <Link href="/members" className="inline-block py-2 underline">
        Check for an existing member
      </Link>
      {sp.err && (
        <p role="alert" className="oura-alert-danger">
          {sp.err}
        </p>
      )}
      <form action={createMember} className="space-y-4">
        <input type="hidden" name="enrolment_key" value={randomUUID()} />
        <div>
          <label htmlFor="new-name">Full name</label>
          <input
            id="new-name"
            name="full_name"
            required
            maxLength={120}
            autoComplete="name"
            className="oura-input mt-2 w-full p-3"
          />
        </div>
        <div>
          <label htmlFor="new-phone">Phone (optional)</label>
          <input
            id="new-phone"
            name="phone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            className="oura-input mt-2 w-full p-3"
          />
        </div>
        <div>
          <label htmlFor="new-email">Email (optional)</label>
          <input
            id="new-email"
            name="email"
            type="email"
            autoComplete="email"
            className="oura-input mt-2 w-full p-3"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          An email lets the guest claim their digital membership through a
          verified sign-in link.
        </p>
        <button className="w-full rounded border p-3">
          Create free membership
        </button>
      </form>
    </div>
  );
}
