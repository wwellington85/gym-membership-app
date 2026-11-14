# Manually issued reward gifts

Management selects gifts based on the member relationship. Points are recognition for visits, not a guaranteed food/drink entitlement. This release implements complimentary gifts with no points debit, regardless of whether the member's facility pass is paid or complimentary. No gifts are created automatically or during migration; there is no email notification in this release.

## Management

Open Members → member → Selected rewards → Issue a reward gift. Enter the specific item/choice, member-facing terms, use-by date and private approval reason. Category is Treat, Quarterly meal or Other. Only active admins can issue/revoke gifts. The same member cannot receive a second unrevoked quarterly-meal gift in the same issuance quarter; redeemed offers keep this guard. Revoking an unused offer permits a corrected replacement. Revocation requires a reason and cannot undo fulfilment.

Issued gifts and reasons are visible on the staff member record. The programme audit records issuing, revoking and fulfilment actors, timestamps and gift IDs. Private staff reasons are omitted from all member queries.

## Member and staff redemption

Benefits → A little thank-you shows available gifts with terms/expiry and a Use this reward link. Used, expired and revoked gifts stay in collapsible recent history (latest 50 records). The member-specific reward page displays a refreshing reward QR, valid for 90 seconds at a time. Merely opening the page does not redeem the gift or spend points. When the refresh sees the gift consumed/expired, it clears the code and refreshes the page to show the stored state.

Front desk/admin staff use Redeem reward in the staff sidebar, the Verify member screen, or the member record. The existing membership scanner recognizes the reward prefix and hands off to the reward flow. Staff scans, checks the member/item/terms, then explicitly confirms fulfilment. A repeated submission reports already redeemed without authorizing another item. Security cannot issue or fulfil gifts. Ordinary membership QR codes cannot authorize rewards.

No new visit, points credit/debit, facility access or payment is created by issuing or redeeming a gift. Any later points-priced catalogue needs a separately approved policy and a spendable points ledger; the earlier 30-point proposal is not a live price.

## Integrity and rollout

Apply 20261114180000_manual_reward_gifts.sql before application deployment. It adds a service-only, RLS-protected gift table and three service-only RPCs. They independently validate active staff role, member state and record eligibility; issuance has a unique idempotency key. Redemption locks member then gift, checks expiry/status and atomically updates the one-use status and audit. Audit failure rolls the status change back. Unused gifts can be revoked by admins. Gift expiry is 10 pm on the selected resort-local date.

The QR endpoint requires an authenticated, active member and filters by both the authenticated member ID and requested gift ID. It returns private/no-store responses. Signed tokens bind member and gift IDs and are cryptographically separated from membership tokens. Staff verifies the signature and expiry again on the fulfilment POST before invoking the database RPC; every redemption rechecks current gift state even if its QR is still within its short lifetime. No long-lived reward secret is placed in the QR.

Validation: 127 tests passed, including database roles and history preservation, idempotency, wrong-member denial, one-use fulfilment, quarterly limits, revocation, expiry/cutoff, atomic rollback, HMAC tampering/purpose separation, authenticated QR ownership and redeemed/expired/inactive member UI states. ESLint, a clean production build and diff checks passed. No physical-device camera/scan walkthrough was available.
