# Free accounts and selected Local Rewards

Anyone can create a free Club account, receive a digital card and earn Club visit points. New accounts receive no automatic outlet discounts or facility access. Local Rewards is a separate staff approval for selected community members; paid passes remain independently dated and retain their published benefits.

## Staff workflow

Open Members, select a person, and expand Activate Local Rewards. Enter an eligibility reason and approve. Admins and active front desk staff can approve or remove Local Rewards; security can verify but cannot change eligibility. The member list shows approval status alongside facility permissions. The member record shows the latest update date and reason. The audit log records the staff actor, member, action, timestamp and reason for each change. No email is sent automatically.

Base rates and custom perks continue to come from the existing rewards_free catalogue entry, now exclusively for approved Local Rewards members. Free signup is no longer a promise of those rates. Paid benefits use their existing purchase snapshots and date cutoffs. Highest eligible rates apply per outlet; discounts never stack.

## Rollout and compatibility

Apply 20261114140000_selective_local_rewards.sql before deploying the application. It creates a protected approval table and performs a one-time preservation of all existing members' base discounts, labelled with a launch preservation reason. Staff can review and remove those approvals individually. It does not modify members, memberships, passes, payments or visit history. Do not repeat the backfill after rollout: doing so would approve newer free accounts.

The table and approval RPC are service-role only, with RLS and no anon/authenticated privileges. Eligibility is resolved on the server; approval is not stored in user metadata or member-editable fields. The database redemption RPC independently checks approval before applying base rates, so changing the UI cannot obtain a discount. Active paid passes can qualify without Local Rewards. Inactive accounts remain blocked. Lookup failures never grant eligibility.

## Member experience and upgrades

Home and the digital card distinguish Free account, Local Rewards and current paid pass. Home and Benefits show live weekly/monthly prices, facilities, outlet rates and differences against today's benefits, with links into the existing date selection and checkout flow. A lower-rate plan does not borrow the rate of a current higher-rate pass in its comparison. There are no recurring charges implied by these one-time dated purchases.

Invitations, self-service Local Rewards applications, events publishing, cabana booking, messaging and limited-time promotional pricing are future work. No fictional discounts, sale timers or booking controls are shown. A future promotion should have explicit eligibility, start/end times, published terms and a validated checkout price frozen into the existing payment snapshot; changing a marketing label alone must never determine checkout totals.

## Validation

Database integration tests cover preservation, new-account denial, staff approval/removal, inactive/security restrictions, reason validation, server-only permissions, audit entries, paid-pass independence and no check-in side effects. Member tests cover default denial, current pass rates, date expiry, non-stacking and live upgrade comparisons. All 108 tests, ESLint and a clean production build passed. Physical mobile layout review is not available in this environment.
