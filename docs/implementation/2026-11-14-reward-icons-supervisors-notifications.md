# Reward icons, supervisors and member notifications

## Reward presentation

Staff choose Drink, Food, Treat or Gift icons when issuing a reward. Suggested titles and member-facing terms are prefilled and editable. Switching icons updates untouched preset wording while preserving custom text. The selected icon is stored on the gift, and appears on staff history, fulfilment preview, member reward cards, the reward QR screen and notification items. Existing gifts receive the generic Gift icon without changing their title, terms, expiry, redemption state or QR identity.

## Roles and permissions

Staff Management now supports Supervisor when creating accounts, filtering or changing roles. Supervisor has the operational front-desk baseline plus reward issuing, fulfilment and revocation by default. Login routing, desktop/mobile navigation, member operations and operational database checks recognize the role. Account administration, role assignment, programme configuration, membership deactivation, access revocation/extension and permission editing remain admin-only.

Admins open Staff Management → Manage reward permissions to control Issue reward gifts, Confirm reward fulfilment and Revoke unused rewards independently for Supervisor and Front desk. Front desk keeps its previous defaults (fulfilment only). Admin retains fixed full access; security remains membership/gate verification. This is a reward-permission matrix, not an arbitrary role builder or delegation of administrative authority.

Reward permissions are checked again on every server action and database RPC. A stale open form cannot bypass a newly revoked permission. Administrators' controls and the configuration RPC verify an active admin. Configuration changes record actor, time, role and new flags in programme audit. The private permission table cannot be edited through a member/session client. No existing staff accounts are reassigned by rollout.

## Member notifications

A bell with an unread count sits next to the membership-card action throughout the member app. It shows owned, unexpired, unused gifts whose seen_at is empty. It refreshes while the app is visible every 45 seconds and on return to the app. A member can open the reward directly without visiting Benefits. Past/used/revoked rewards remain in Benefits history.

Opening a reward marks that specific gift seen via an authenticated POST, derives the member ID from the session and updates only the owned gift. Prefetch is disabled on gift links so preview fetching cannot mark a gift read. The badge updates after successful marking; read status persists across sessions/devices. Viewing a gift still does not redeem it. This is an in-app notification; it is not a background push or email delivery service.

Both notification and read endpoints return private/no-store responses. Notifications omit staff reasons, actors and other-account gifts. The read endpoint rejects cross-origin requests and cannot mark someone else's gift seen. No notifications are sent to external services.

## Rollout and verification

Apply 20261114190000_reward_icons_and_supervisors.sql before deploying application code. It adds visual/read fields and reward permission defaults, updates reward RPC authorization, adds a transactional icon-aware issuance wrapper, and extends explicit operational front-desk role checks to Supervisor. Existing member/pass/payment/visit data, staff roles and existing gift content/status are fingerprinted before and after migration.

All 131 tests passed, plus ESLint, a clean production build and diff checks. Coverage includes supervisor login routing, operational grants/visits, configurable issuing/fulfilment, fixed admin/security boundaries, inactive role rejection, icon/idempotency checks, read ownership, private notification responses and permission lookup failure. Physical phone notification and layout review was unavailable.
