# Travellers Club implementation: loyalty and access foundation

This change implements the core product restructuring and reliability fixes from the IA/UX audit. It retains the dark theme; a theme redesign remains a separate pass. The owner applied the migration to the gym database on 12 November 2026. Read-only verification confirmed the new tables/functions and the $15 gym / $25 resort catalogue. Production deployment is being prepared.

## Confirmed product decision

- Rewards is free, persistent membership attached to a member identity.
- `gym_day`: $15 USD, one Jamaica calendar day, gym only; ordinary Rewards discounts. No pool, chairs/towels, showers, lockers, or lounge entitlement.
- `club_day`: $25 USD resort day pass. Retains the existing gym, pool, beach chairs/towels, showers, lockers, lounge, and enhanced-discount inclusions confirmed by the user.
- Weekly/monthly products retain their configured prices/inclusions.
- Paid products are separate dated passes. A future purchase or an expiring pass never replaces loyalty identity or a different valid pass.
- Access ends at the existing 10 pm Jamaica cutoff on the final day. One calendar day ends on its start date.

The audit's original interpretation of the $15/$25 discrepancy is superseded by this product clarification. Actual catalogue prices come from the database; the obsolete hardcoded picker is no longer used in any route.

## Implemented

- Public introduction and distinct free-join flow, without facility waiver, paid plan choice, pending application, or personal form values in error URLs.
- Normal Supabase email verification/account confirmation; verified sign-in claims staff-created identities. Old application-account creation no longer creates preconfirmed accounts.
- Repeat sign-in/sign-up preserves existing membership and all passes.
- Home, Card, Benefits, Account navigation. Home leads with card/useful benefits; access shopping and renewal have a separate destination.
- Dated access passes with frozen product terms, retained history, multiple coexisting products, explicit start date and renewal intent, and purchase-time waiver acceptance.
- Server-side quotes checked against the current catalogue before checkout.
- Atomic payment fulfilment using PostgreSQL transactions, row locks, transaction-ID serialization, amount/currency checks, and retry idempotency. Guest confirmation requires fulfilment, not just payment status.
- Checkout submission keys prevent duplicate local order creation. This is not a claim that the gateway itself prevents every duplicate charge.
- Persistent payment references, safe rechecking, legacy-checkout blocking, and paid-but-unfulfilled staff reporting.
- Staff verification separated from gym visit recording. Scan submits token through a server action and redirects to a member ID rather than carrying the token into subsequent URLs.
- Signed QR verification requires an active authorised employee, omits contact fields, and returns explicit gym/resort permissions.
- Member deactivation blocks facility eligibility and benefit recording. Revocation is a separate, reasoned, administrator-only operation and does not issue a refund.
- Full-directory search and status/access filtering before pagination, explicit member selection, and an inactive-member directory.
- Staff creation starts with free membership; selling/renewing access is a separate explicit transaction.
- Staff payment reporting includes state, currency, service fulfilment, filtering, and a permission-checked CSV export.
- A standalone payment receipt is explicitly labelled as not granting/renewing access.
- Staff-recorded benefit usage with outlet and bill reference, server-calculated eligible percentage, daily duplicate-bill protection, and guest activity history. This records use after the outlet applies the discount; it does not change a POS bill or redeem points.
- Programme/audit views, separate activity logs, daily scheduled programme changes through protected maintenance, and removal of page-traffic-based expiry/downgrade work.
- Basic benefit-use and repeat-benefit-day counts. These do not establish booking attribution, incremental revenue, or margin.
- Desktop employee navigation plus mobile task navigation, improved labels, scroll recovery for authentication, main landmarks/skip link, clear alerts, and QR loading/retry/foreground refresh.
- QR number uses the full stable identity and is searchable. Name/phone lookup remains available. No offline authorisation or wallet support is claimed.
- Unsupported spend/redemption claims removed from active guest journeys; historic activity points remain available without a redemption promise.

## Required rollout sequence

1. Back up the database and test against a staging copy, including its existing triggers, constraints, RLS policies and auth email configuration. The test schema was checked against read-only API metadata, but API metadata does not expose every trigger or constraint.
2. Review existing paid memberships with implausible dates before backfilling. Review old Fygaro pending/paid records that lack the new purchase metadata. Do not guess service dates or retroactively classify historical $15 purchases as gym-only.
3. Apply `supabase/migrations/20261112140000_loyalty_access_and_payment_fulfilment.sql` before deploying this app version. The migration is transactional. It preserves existing valid legacy access dates/terms, creates independent access records, adds the explicit gym product and changes the resort day catalogue to $25.
4. Deploy app and database together during a controlled maintenance window. Do not roll back just the application to the old payment handler after accepting new-format orders.
5. Configure `CRON_SECRET` in hosting and ensure the protected maintenance endpoint runs at `0 5 * * *` UTC (midnight Jamaica). `vercel.json` includes this schedule. Other hosting needs an equivalent scheduler. Verify failures are monitored; page visits no longer apply scheduled changes.
6. Verify the existing Supabase confirmation/magic-link email templates and allowed redirect URLs, including `/auth/confirm`. Test claiming an existing staff-created record without creating duplicates.
7. Use a payment sandbox to test a first purchase, same-product renewal, future start, a second concurrent product, duplicate webhook delivery, fulfilment failure/retry, payment currency mismatch, revoked pass, and guest return routing. No real payment was performed as part of implementation.
8. Perform signed-in desktop/mobile and assistive-technology acceptance testing with representative staff and guests. The earlier browser-control failure prevented a reliable authenticated visual walkthrough.

The migration intentionally revokes direct client-role writes to payments: checkout metadata and fulfilment are trusted server operations. Included staff payment/sale flows use guarded server operations. Any external system that currently writes directly as an authenticated client must be identified and migrated before rollout.

### Read-only preflight examples

```sql
-- Investigate; do not automatically truncate or extend access.
select m.id, m.member_id, p.code, m.start_date, m.paid_through_date,
       p.duration_days
from public.memberships m
join public.membership_plans p on p.id = m.plan_id
where p.grants_access and p.duration_days < 3650
  and m.paid_through_date > m.start_date + p.duration_days + 31;

-- Historic payments require checking against actual gateway/desk records.
select id, member_id, status, provider_reference, created_at
from public.payments
where provider = 'fygaro'
order by created_at desc;
```

## Verification

- `npm test`: actual access rules, signed-webhook/auth boundaries, preservation on repeat sign-in, existing staff-password regression suite, and migration/transaction tests using embedded PostgreSQL (PGlite).
- PostgreSQL tests exercise atomic rollback on an injected entitlement failure, duplicate fulfilment, reused transaction rejection, amount mismatch, function/table grants, gym access checks, zero-point awards, member inactivity, staff inactivity, directory pagination, staff sale idempotency, benefit recording/duplicates, revocation, scheduled changes and overview counts.
- `npx tsc --noEmit --incremental false` and `npm run build` validate the app. The production build requires network access to fetch the project's existing Google Fonts.
- `npm run lint` excludes generated `.vercel` output, rather than linting built/minified bundles.

### Final local verification results

- 41 tests passed, including migration/transaction tests in embedded PostgreSQL.
- TypeScript check, lint, production build, and `git diff --check` passed.
- Seven read-only HTTP checks against the production build passed: public introduction, simplified join, employee login wording, guest login wording, member-route authentication redirect, QR API authentication, and payment-status API authentication.
- No guest account was created, no email was sent, no payment was made, and no live hotel records or schema were changed. The only remote inspection was database schema metadata.

## Still separate follow-up work

- Real-device visual/accessibility validation and the later light-theme/hospitality design exploration.
- Dedicated outlet-scoped staff roles and partner access. Current benefit recording is restricted to active front desk/admin accounts; security only verifies and records authorised gym visits.
- Approved return-visit offers, campaign/communication consent and delivery, published programme/privacy terms, and booking/POS integration. No offer, consent language, booking policy, refund policy, or contact number has been invented.
- A complete points ledger/redemption programme, only after its business rules and economics are approved.
- Apple/Google Wallet and offline identity convenience; access still requires current staff-side verification.
- A production reconciliation procedure for legacy paid/pending transactions. Existing legacy paid transactions without frozen order data are deliberately not auto-fulfilled or auto-refunded.

These follow-ups are not prerequisites for a free digital benefits membership once the implemented core has passed staged acceptance and the hotel has approved its programme terms.

## Production configuration compatibility

The webhook supports either `FYGARO_HOOK_SECRETS` for rotated keys or the existing `FYGARO_WEBHOOK_KEY_ID` / `FYGARO_WEBHOOK_SECRET` pair. Checkout return routing recognises `NEXT_PUBLIC_APP_URL`, the existing `NEXT_PUBLIC_SITE_URL`, and the deployment host as a fallback. A production `CRON_SECRET` was configured securely in Vercel for scheduled maintenance. Pulled environment files and local provider metadata are excluded from source tracking and deployment uploads.
