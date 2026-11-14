# Opt-in reward push and simplified reward types

## Header and reward form

The notification bell is now the rightmost header action, after the membership-card button. Its panel aligns with the right content edge and has a bounded scrollable height. Reward icons are now the single Reward type selector (Drink, Food, Treat, Gift); the separate category dropdown is removed. Food optionally enables Quarterly meal gift, retaining the existing one-per-member-per-quarter guard. Suggested meal wording updates only untouched presets; custom wording remains editable and preserved. Internal policy categories are derived from this selection for compatibility with existing gifts and limits.

## Member opt-in

Account → Reward notifications offers Enable push notifications on supported browsers. Permission is requested only after the member taps the button. iPhone/iPad users need an installed Home Screen app and iOS/iPadOS 16.4 or later; browser tabs receive installation guidance. Unsupported browsers keep the in-app bell. Members can turn off push for the current device in the same section.

The registration endpoint derives the member from authentication, checks active status and same-origin JSON requests, validates subscription keys and known browser push-provider HTTPS hosts, and stores at most ten devices per member. It never accepts a member ID supplied by the browser. An explicit opt-in on a shared browser rebinds its subscription to the authenticated account. An HTTP-only device cookie lets Account sign-out remove only that member's current-device registration; other devices remain enrolled. A previous browser subscription is not silently enrolled for a different account.

All subscription/config responses are private/no-store. Only the public VAPID key is returned to the client. Push endpoints are carried in a request header/body rather than URL query logs. Subscription data is service-only with RLS and no public/authenticated table access.

## Delivery and privacy

A new gift inserts one durable outbox row in the gift transaction. Repeated issuance with the same submission key does not create another push event. After successful issuance the server attempts delivery to opted-in devices. It checks the current member/gift state and skips inactive members, seen gifts, revoked gifts and expired gifts. It does not send historical gift notifications during migration.

The encrypted push payload and visible lock-screen content are generic: a new Travellers reward is waiting. They omit names, member numbers, reward contents and private approval notes. The existing standard Node Web Push library handles VAPID signing and payload encryption. The service worker always displays a user-visible notification, and notification clicks open only the same-origin member Benefits/rewards destination. Authentication still protects reward details and QR redemption.

Queue claims use row locks and leases to prevent simultaneous sends. Successful subscription IDs are remembered so retries omit devices already accepted by their push service. Dead 404/410 endpoints are removed. Temporary failures return to the queue with a delay; attempts are bounded at four. The existing protected daily programme-maintenance job retries up to five queued gifts per run. Normal new-gift delivery is attempted immediately. Browser/OS delivery is best effort; duplicate transport acceptance around a process crash is further contained by a stable gift notification tag. A push never redeems a gift, changes points or grants access.

## Configuration and rollout

Apply 20261114200000_opt_in_reward_push.sql before deploying. It adds private subscriptions/outbox storage and service-only registration/claim/delivery functions, and queues only subsequent gift inserts. Existing membership, staff, payment, visit and gift records remain unchanged.

WEB_PUSH_PUBLIC_KEY, WEB_PUSH_PRIVATE_KEY and WEB_PUSH_SUBJECT are configured in production. Keep the generated VAPID key pair stable; rotating it requires device subscriptions to be renewed. The private key is a Vercel secret and is not bundled or returned by APIs. The existing CRON_SECRET protects retries. No new cron schedule or paid notification provider was introduced. No devices were enrolled or push messages sent by the deployment work.

## Verification

All 137 tests passed, plus ESLint, a clean production build and diff checks. Coverage includes subscription ownership/limits, provider/SSRF validation, private configuration, cookie setup, unauthenticated/cross-origin denial, durable queue idempotency/leases/retry limits, remembered device deliveries, 410 cleanup, generic visible worker content and same-origin notification navigation. Existing permission, gift, payment and member-state checks remain passing. Physical iPhone permission and end-to-end delivery require a real member device.

Sources: [WebKit: Web Push for Home Screen apps](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) and the [Web Push library documentation](https://github.com/web-push-libs/web-push).
