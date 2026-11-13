# Permanent membership numbers and focused Card screen

## Identity and migration

Members now have a separate, stored 12-digit `member_number`. UUID primary keys, auth user links, access passes, payments, visits, and rotating QR claims remain unchanged. Numbers are identifiers, not sign-in credentials or proof of access.

Migration `20261113010000_permanent_member_numbers.sql` adds a bounded non-cycling PostgreSQL identity sequence, backfills existing rows automatically, enforces uniqueness and 12-digit range, and prevents number changes. New members receive numbers automatically across email/Google signup and desk enrolment. Number gaps from failed or idempotent inserts are expected and harmless. Rerunning the migration preserves assigned numbers. The migration includes a gym/Club-schema guard for manual SQL-editor execution.

The migration was applied successfully to the Gym Membership App project `bdnwjalcopncpccdnivn` before deploying the application selections. Live read-only checks confirmed every member has a unique 12-digit number, unchanged UUID fingerprint, unchanged membership/pass/payment/visit counts, and successful exact numeric plus legacy staff search. Travellers Apps Portal was not modified. No real enrolments, payments, visits, or pass grants were created for validation.

## Guest and staff experience

Home is a compact membership summary: current product, active/assistance status, access expiry, and Show my card action, followed by current benefits and included facilities. It no longer renders the full navy card. Card remains the focused presentation screen with the member's name, actual permanent number in three groups of four, access expiry, and separate live QR. A missing number shows an unavailable state rather than fabricating a UUID-derived replacement.

Staff verification accepts all 12 digits, grouped with spaces or hyphens. Existing UUID/TC references and rotating QR tokens remain supported. General member search accepts the new number without changing its paginated response or existing filters/role restrictions. Staff profile and verification screens display the new formatted number.

## Validation

89 tests pass, including backfill, UUID/foreign-key preservation, stable reruns, unique new allocations, immutable numbers (including attempted DEFAULT reassignment), explicit-number rejection, public RPC denial, numeric/legacy search, number formatting, grouped Card rendering, and Home's summary/Card distinction. Lint, TypeScript, and production build pass. The rendered-component regression checks verify the Home/Card distinction and grouped number. A local browser preview was attempted with synthetic sample data but automatic approval review could not grant browser access because its usage limit was reached; no visual browser pass is claimed for this release. Native iPhone appearance and actual guest QR scanning remain device acceptance work.
