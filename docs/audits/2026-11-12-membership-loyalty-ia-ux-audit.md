# Travellers Club: membership and hotel loyalty audit

**Date:** 12 November 2026
**Scope:** Product strategy, information architecture (IA), guest UX, hotel operations UX, visual design, accessibility, lifecycle states, and implementation behaviours that affect trust.
**Recommendation:** Continue developing one Travellers Club guest product. Make free hotel loyalty the foundation, with paid gym/resort access as an optional product. Give hotel employees a distinct operational workspace on the same platform.

## 1. Evidence and limits

This is a source-based expert audit of this repository, including its public/authentication routes, member screens, staff screens, navigation, styles, PWA implementation, payment handling, QR workflows, and available migrations. It is not a claim of completed usability research or a production security assessment.

The local development server started, but browser automation repeatedly stalled before a usable screen could be inspected. Authenticated visual walkthroughs, real-device measurements, contrast measurements, screen-reader testing, live database policies/triggers, actual payment-provider behaviour, and production analytics were not verified. No real accounts, payments, visits, or membership records were created or changed. Application source was not changed for this audit.

Findings distinguish **confirmed source behaviour**, **design judgement**, and **validation needed**. A route existing in the repository does not establish that customers encounter it in production. Conversely, functionality outside this repository may exist elsewhere in hotel operations.

Priorities:

- **P0 — release blocker:** Can create materially wrong access, payment, or disclosure outcomes. Resolve and verify before expanding rollout.
- **P1 — core journey:** Prevents or substantially undermines joining, using benefits, buying/renewing access, or serving guests accurately.
- **P2 — improvement:** Improves comprehension, efficiency, accessibility, or maintainability; some accessibility failures may become release blockers after testing.
- **Later:** Useful only after the core programme works and demand is demonstrated.

## 2. Overall assessment

The app has a useful operational foundation: membership records, free rewards, paid passes, a digital card with signed rotating QR, staff lookup, check-ins, payments, staff roles, configurable discounts, extra benefits, and activity views. Its Travellers Club name and resort-wide benefits already support a broader identity than a gym-only app.

The central problem is that the underlying model and interface treat **loyalty identity, paid access, visit activity, and programme status as variations of one membership plan**. Hotel loyalty needs a persistent relationship. A gym or resort pass is a time-bound entitlement. Those must coexist without one replacing the other.

The current guest home prioritises points, total check-ins, a numeric tier, leaderboard position, and streaks. That suits a frequent gym visitor more than a holiday guest who wants to show a card, understand a dining benefit, or return next year. Meanwhile, the hotel interface measures membership and gym activity more than repeat business or benefit delivery.

| Area | Assessment | Main implication |
|---|---|---|
| Product proposition | Partially aligned | Travellers Club is broad enough; free membership feels like the lowest paid-access tier |
| Guest IA | Needs restructuring | Core loyalty tasks compete with gym metrics and repeated plan comparisons |
| Joining | Too much friction for a free card | Facility questions and waiver appear before the guest receives value |
| Digital card | Strong starting point | Identification is coupled to recording a visit; fallback use is incomplete |
| Loyalty mechanics | Incomplete in this repository | Points/spend/redemption copy exceeds the visible delivery workflow |
| Paid access | Needs urgent correction | Purchase dates, renewal, pricing consistency, and confirmation have defects |
| Staff operations | Useful gym/desk foundation | Outlet validation and programme administration need distinct workflows |
| Visual design | Coherent direction, weak hospitality hierarchy | Dark glass can remain an accent; readability and brand context need more weight |
| Accessibility | Source risks identified | Labels, scroll containment, states, focus, and contrast need formal verification |
| Retention | Underdeveloped | Little guest-facing support for the next visit, a future booking, or benefit history |

## 3. One app or separate apps?

### Recommended product arrangement

**One customer account, one loyalty identity, one guest app, and one shared platform; separate guest and employee experiences.**

Use Travellers Club as the umbrella. Explain it in plain language, for example: “Your free Travellers membership, hotel perks, and optional resort access.” Test the wording with actual guests and local members.

Within that umbrella:

- **Travellers Rewards:** Free membership, digital card, published benefits, preferences, and eventually a complete earn/redeem programme if the hotel chooses to operate one.
- **Gym & Resort Access:** Day, weekly, and monthly products with explicit facilities, dates, hours, and purchase terms. The present paid products include much more than the gym, so “Gym membership” alone is an incomplete label.
- **Hotel stay:** Optional context associated with a reservation, if the hotel can verify it. A stay must not be inferred from purchasing a pass or checking a signup box.
- **Employee workspace:** Service tasks and programme management, presented separately from the guest app. This can remain in the same codebase and share authentication infrastructure without sharing navigation or layout.

| Option | Advantages | Costs and risks | Decision |
|---|---|---|---|
| Continue adding loyalty screens to the current structure | Least immediate restructuring | Confusing tiers and access rules persist; every feature inherits the wrong model | Avoid |
| Reorganise this app as one guest membership product | One identity/card; gym customers can become hotel customers; guests can buy access where applicable | Requires entitlement and navigation changes | **Recommended** |
| Separate gym and hotel loyalty apps | Independent branding and specialist gym functionality | Duplicate signup, identity linking, cards, preferences, support, and programme logic | Not justified by the present scope |
| Separate employee workspace using shared services | Focused gate, desk, outlet, and management tools | Requires explicit role/task design | **Recommended alongside the guest app** |

A separate customer gym app becomes reasonable if gym operations become a genuinely distinct business with substantial specialist workflows—class schedules, trainers, workout plans, coaching, or multiple independent locations—and evidence shows little audience overlap. Even then, retain a shared identity and entitlement service where appropriate.

Do not interpret “hotel loyalty app” as a requirement to rebuild a booking engine, property-management system, or full in-stay concierge product. Start with links or verified integrations into existing hotel services. Add a dedicated stay area only when it can offer reliable, useful information.

As external reference points, Hilton presents loyalty benefits and stay services together, while Marriott places member benefits alongside reservation and trip navigation. These support the feasibility of one hotel relationship with contextual services; they do not establish that Travellers should copy a large-chain feature set. See [Hilton member benefits](https://www.hilton.com/en/hilton-honors/member-benefits/) and [Marriott member benefits](https://www.marriott.com/loyalty/member-benefits/member.mi).

## 4. Repair the conceptual model first

The proposed model is:

```text
Guest / member identity
├── Free loyalty membership (persistent)
│   ├── Membership number and digital card
│   ├── Eligible benefits and programme terms
│   └── Preferences and communication choices
├── Access entitlements (zero or more)
│   ├── Gym / resort pass: facilities + valid dates + state
│   └── Verified hotel-stay access, if hotel policy grants it
├── Purchases and payments (separate states)
├── Visits and benefit-use events (separate purposes)
└── Points ledger and redemptions, if launched
```

This is a conceptual target, not a requirement to create every feature immediately. The implementation should preserve historical purchases and benefit rules rather than repeatedly overwriting one current plan.

**A free member is an active member.** “Free” is a price, not the opposite of “Active.” Display “Rewards member · Active,” and show paid access separately, for example “Resort pass · Valid today until 10 pm Jamaica time.”

**A monthly pass is a duration/product, not automatically an earned loyalty tier.** The dashboard maps free/day/week/month to levels 1–4. A guest may interpret that as loyalty status earned through stays or spend. Use product names now. Introduce earned status only after qualification, expiry, progression, and benefits are defined.

**Stay eligibility requires a policy decision.** If an in-house hotel guest already receives pool or gym use through a room booking, the app must recognise that before offering a paid pass. If hotel policy differs, state that clearly. The current “Are you staying at the hotel?” field is optional self-reported information stored on the application; it is not a verified reservation or entitlement.

**Do not treat pass expiry as loss of loyalty membership.** “Your resort pass has ended; your Rewards benefits continue” is clearer than “Downgraded to Rewards.” Keep operational expiry history without framing the guest relationship as a demotion.

## 5. Guest experience audit

### Discovery, login, and signup

**G01 · P1 · Public entry offers authentication before a reason to join.** The root route redirects unauthenticated visitors to login. The login provides a join link, but there is no root-level explanation of the free card, eligible perks, or who the programme serves. Add a concise public introduction with “Join free,” “Sign in,” and “Explore passes.” Keep staff sign-in available separately. [E01, E02]

**G02 · P1 · The free signup journey contains paid-facility friction.** `/join` requires name, email, password and confirmation, a plan selection, and a facility liability waiver; it also presents start date, country, current-stay status, phone, and notes. Optional fields still impose reading and decision costs. The waiver is required in the rendered form even for free members. Move facility-specific information and waiver acceptance to access purchase/use; enforce the appropriate acceptance server-side and version it. This is a UX recommendation about relevance, not a legal assessment of the waiver. [E03]

**G03 · P1 · Activation messages contradict the implemented free path.** Signup says activation follows front-desk verification/payment. The action creates a confirmed auth user, a free membership, and a pending application, then directs the free member to the dashboard. Tell free members when their card is ready, separately explain any required identity verification, and reserve pending paid requests for genuinely pending services. [E03]

**G04 · P1 · Multiple account-creation routes imply different programme lifecycles.** `/join`, `/auth/sign-up`, and `/join/create-account` coexist, with a legacy request-received route returning to the join page. Their production entry points need inventory. Keep one canonical free-join journey and a clear “claim existing membership” journey; redirect or retire obsolete entry paths after checking existing links. [E03, E04]

**G05 · P1 · Error recovery includes personal form values in URLs.** The join failure helper serialises name, email, phone, notes, and other submitted values into query parameters. This also sends users through a page redirect to recover errors. Preserve form state locally/server-side as appropriate, show field-specific feedback, and keep personal notes/contact data out of the URL. Do not preserve passwords. [E03]

**G06 · P2 · Login speaks to staff and guests simultaneously.** “Username or email” reflects staff usernames, while guest accounts use email. Offer an email-first guest sign-in and a separate employee entry. Existing password visibility, loading feedback, recovery, and email-link support are useful foundations. Decide whether email link or password is the default through testing rather than assuming either suits every visitor. [E02]

### Home and navigation

**G07 · P1 · The dashboard foregrounds gym behaviour over hotel value.** Three metric bubbles and the leaderboard precede the membership section. A returning hotel guest receives weak cues about useful benefits today or their next visit. Reorder around “Show my card,” relevant benefits, current access/stay context, and a reason to return. Gym history and optional challenges belong within the access area. [E05]

**G08 · P1 · The numeric tier implies an earned relationship the app does not explain.** The 1–4 tier mapping follows pass duration. The Tier page only gives general explanations. Remove numeric tier progression until a genuine programme rule exists, or label the dimension explicitly as the selected access product. [E05, E06]

**G09 · P2 · Benefits and Settings both repeat extensive plan comparisons.** Settings combines account management, current plan, the full plan picker, comparison cards, password change, and logout. Benefits also compares tiers. Put browsing/purchase in one Access destination; keep Benefits focused on what the member can use and Account focused on personal details and preferences. [E07, E08]

**G10 · P1 · The Upgrade shortcut has no selected plan.** Home links free/expired users to `/member/upgrade` without `plan`; that route requires the parameter and redirects to Settings with a missing-plan error. Make “Explore passes” open a valid catalogue, or send a selected product to confirmation. Settings currently does not render that query error, so the transition can be especially opaque. [E05, E08, E09]

**G11 · P1 · Renewing the current plan is obstructed.** “Renew now” goes to Settings, but the plan picker disables Continue when the selected plan is the current plan and renders that plan as nonselectable. Renewal is a separate intent from changing product. Add an explicit renewal action showing the new access period and total before payment. [E05, E08, E10]

### Card, benefits, points, and retention

**G12 · P1 · The card is not yet a fully resilient physical-card replacement.** A visible membership number and rotating QR are good starts. The QR fetches a token online every 30 seconds; errors expose technical details and clear the QR. Its text describes staff checking the member in, rather than identifying the guest for different purposes. Add a loading state, a clear retry action, expiry awareness, and a practical manual-lookup fallback. “Show this card to use your member benefits” better describes the general purpose. [E11]

The displayed number is derived from part of the member ID, while staff search currently supports name/phone rather than that card number. Define a stable, unique membership number and make it searchable. Do not assume a screenshot or wallet pass can safely replace the rotating signed token: a static identity reference can support server-side staff lookup, while access authorisation still needs current verification.

**G13 · P1 · Benefits can imply access that is no longer valid.** The Benefits page loads plan discounts and an access flag, but renders facility access from static tier metadata and does not load the membership dates/status needed to determine present eligibility. A guest can see access listed while another screen shows expiry, or after an administrator changes access rules. Separate “This product includes…” from “You can use this today,” using one shared eligibility calculation. [E07, E12]

**G14 · P1 · The points promise is more complete than the delivered workflow.** The Points page describes eligible spend and redeemable drinks/meal credits; the plan picker also advertises spend earning. In the reviewed repository, visible awarding flows are check-ins, and the Points page offers example rewards without thresholds, a redemption action, or a ledger. No spend capture/redemption route was found. Verify any external/manual process. Until an operational programme is defined, remove unsupported promises or explicitly launch with discounts and a digital card. [E06, E10, E14]

**G15 · P1 · Benefits lack enough certainty at the moment of use.** “Discounts may vary” and “staff will confirm” leave eligibility ambiguous. Each published benefit should state where it applies, exclusions, validity, combination rules, and how to use it. Use “Show card” beside the benefit. Do not make the guest self-confirm a valuable redemption without staff validation. [E07]

**G16 · P2 · The product does little to close the repeat-business loop.** There is no guest-facing stay/booking history, offer-use history, or clear next-visit journey in the reviewed routes. A lightweight initial improvement is an approved return-visit benefit and a link to the existing direct-booking channel, with attribution. A full booking engine is unnecessary. Add preference-based communication only with a clear choice and a real delivery process.

**G17 · P2 · Account self-service is narrow.** The member Settings page does not offer contact editing, communication preferences, privacy/account-help information, or a clear support route. Give members a way to correct their details, understand programme terms, recover access, and ask for account deletion/help. Avoid putting all of this behind a front-desk visit. [E08]

**G18 · P2 · Installation appears before first-session value.** The PWA prompt is shown on the first authenticated mobile session and sits above member content. Offer installation after the guest has used the card or received a benefit, while keeping ordinary browser use fully supported. Apple/Google Wallet is an optional later convenience, not a prerequisite for launch. Static-asset caching currently does not establish offline card or eligibility support. [E15]

## 6. Hotel-side experience audit

### Navigation and service roles

**H01 · P1 · Applications and staff Account lack clear navigation entry points.** Applications is allowed for front desk and admin but absent from the bottom navigation and admin More screen; no direct navigation link to the applications index or staff Account was found in the reviewed app/components. Add a visible Requests queue with a pending count and a staff profile menu. If free join becomes immediate, keep that queue for pass requests/exceptions only. [E16, E17]

**H02 · P1 · Roles describe the gym desk/gate, not the full benefit operation.** Existing roles are admin, front desk, and security. Restaurant/bar and other participating outlets need a narrow “verify member / view this outlet’s benefits / record use” experience. Add outlet-scoped permissions without giving servers payment-administration or member-editing access. Confirm which outlets are operated by the hotel versus partners before choosing integration depth. [E16, E18]

**H03 · P1 · Scan and check-in are treated as the same intent.** Camera scanning uses `autoRecord` and can submit a visit after identifying an active member. Staff checking a restaurant discount may therefore record a check-in and award points. Separate identification from actions: “Validate benefit,” “Record gym visit,” and “Redeem reward” are different operations. A fast gate mode may auto-record a gym visit after eligibility is clear. [E14]

**H04 · P1 · Recording a visit can be mistaken for granting gym access.** Scan code deliberately allows active free members to record loyalty check-ins. Manual gate/profile actions also test membership activity without requiring a facility entitlement. That can be legitimate for loyalty, but “Check in now” at the gate does not adequately express the distinction. Show explicit per-facility permission and keep activity recording separate from admission. This finding does not establish that a physical gate is automatically opened. [E14, E19]

**H05 · P1 · Gate lookup chooses a first match before explicit identity selection.** With multiple name/phone matches, the security view promotes the first returned record to “Gate Status.” Ask staff to select a match or scan a unique card before showing a confirmable admission action. Mask unnecessary contact detail and display enough information to disambiguate safely. [E19]

**H06 · P1 · Gate confirmation offers an action the server refuses.** The past-due view offers “Confirm check-in” and then “Proceed check-in,” but the action rejects inactive membership. Either block with a clear front-desk resolution, or implement an actual authorised exception with reason and audit trail. Do not offer a pretend override. [E19]

**H07 · P1 · “Dining Only” understates free-member eligibility.** Rewards benefits also include spa, gift shop, and watersports in the configured product copy. “Dining Only” can cause employees to deny legitimate benefits. Use “Rewards benefits · No paid facility access,” followed by the precise facility/outlet decision relevant to the employee. [E12, E14]

### Records, payments, and programme management

**H08 · P1 · Member filters operate on an already-limited set.** The directory first loads up to 50 members (20 for security), then applies membership-status/access filters in application code. Older matching members can disappear from a filtered list without a way to page to them. Payments also searches within a fetched 400-record window. Apply filters before pagination, show result counts, and label deliberately limited recent-history views. Search for a specific identity must cover all eligible records. [E19, E20]

**H09 · P1 · Paid-access controls conflate recording money and extending service.** The standalone Add Payment action records payment and updates `last_payment_date`, but does not extend access. The Change Plan action updates access and optionally records payment. Staff can reasonably assume a renewal payment renews membership. Give distinct intents—“Renew pass,” “Sell/change pass,” and “Record an existing payment”—with an explicit before/after date and money summary. [E21]

**H10 · P1 · Payment lists do not surface reconciliation states.** The Payments index loads amounts/methods/dates but omits status, currency, provider identifiers, and pending/failed filters. Online checkout creates pending records, so they can look too much like completed desk payments. Show payment state separately from access activation state, include currency, and provide exception handling for paid-but-not-active records. A CSV export endpoint exists, but the index does not expose its controls; provide an intentional authorised reporting flow. [E20, E22]

**H11 · P2 · Rewards Manager is a misleading catch-all.** It manages discount percentages, facility access, join visibility, scheduled changes, extra benefits, and points per check-in. It does not present a rewards catalogue/redemption operation. Rename it “Programme & benefits,” split its tasks into focused sections, add a guest preview, and show when changes affect existing members versus new purchases. Points-per-check-in is also editable in Settings, creating two owners for one setting. [E23]

**H12 · P1 · Some programme changes depend on page traffic.** Scheduled benefit updates are applied when the Rewards Manager page is rendered; paid-plan downgrades run when the staff layout is rendered. Time-based guest promises should not depend on a manager or employee opening a page. Use dependable scheduled processing plus consistent current-time eligibility, and show operational failures to the appropriate role. The downgrade helper also evaluates any not-currently-active paid row, including pending/future-start rows; it needs an explicit expired-only condition. [E23, E24]

**H13 · P2 · Activity Logs are narrower than the name implies.** The reviewed log view assembles payment/check-in events. It does not establish a full audit trail for benefit-rule edits, overrides, membership status changes, or rewards adjustments. Expand event coverage and record actor, reason, previous/new value, and time where necessary. Keep ordinary guest activity and privileged administrative changes distinguishable. [E25]

**H14 · P1 · The dashboard does not answer the loyalty business question.** It measures active access, Rewards-only membership, renewals/downgrades, visits, and top visitors. It lacks member return frequency across hotel/outlet activity, benefit use, attributable repeat bookings, and programme cost. Also, “Active Access” counts only the derived `active` status, excluding access still valid but marked `due_soon`. Separate “valid now” from “expires soon” so operational totals reconcile. [E26]

**H15 · P2 · Deactivated records lack an obvious recovery directory.** The directory filters `is_active=true` unconditionally; the profile supports reactivation if staff can reach it. Add an authorised inactive/all-members view and a deliberate duplicate-resolution process. Hiding a record should not be described as merging it or cancelling access; those are separate intents. [E19, E27]

## 7. Trust and lifecycle defects affecting UX

These are included because accurate states are part of the experience. They warrant targeted engineering verification rather than a cosmetic redesign.

**T01 · P0 · A first paid purchase can inherit a free membership’s ten-year date.** Join bootstraps the free row with approximately 3,650 days. The webhook uses any existing future `paid_through_date` as the base for adding paid duration, without checking whether it belongs to a free plan. A source-logic illustration for 12 November 2026 produces free paid-through 9 November 2036, then 10 November 2036 after a one-day purchase. This calculation was reproduced locally without database access; a live purchase was not attempted. Only extend an existing compatible paid entitlement. A first purchase needs its own chosen start/end. [E03, E28]

**T02 · P0 · Payment confirmation and access activation can diverge permanently.** The webhook marks a payment paid before updating membership. Subsequent failures can return success to the provider, and retries exit early for an already-paid payment. The final membership update error is not checked. The guest return screen watches payment status and may redirect to the card before entitlement activation succeeds. Make fulfilment retryable and transactional/idempotent, and confirm both payment and access outcomes. [E22, E28]

**T03 · P1 · The selected pass start date is not carried into checkout.** Join stores `requested_start_date` on an application, but the paid checkout request carries only a plan code. The webhook calculates dates from existing membership/today and does not apply the requested start. Preserve and validate the intended service period through order, payment, fulfilment, and receipt. [E03, E09, E28]

**T04 · P1 · Dates use inconsistent rules.** Staff plan assignment calculates an inclusive end with `duration_days - 1`; the payment webhook adds the full duration and uses a UTC date. The shared access rule ends service at 10 pm Jamaica time, which is not clear in the product confirmation. Establish one rule for new purchase versus renewal, calendar-day versus elapsed-time access, and local cutoff; display it before purchase and on the card. [E12, E21, E28]

**T05 · P1 · Price and benefit display have several sources of truth.** The hardcoded PlanPicker shows a $25 day pass; tier metadata, join fallback, and the price migration show $15. Discounts are hardcoded in the picker but configurable in the database elsewhere. Correcting one screen will not prevent recurrence. Feed catalogue, checkout, comparison, and staff summary from versioned product data; preserve the purchased terms on the order. Actual production prices were not queried. [E03, E10, E12, E29]

**T06 · P1 · Points settings do not behave as presented.** Management can save zero points per check-in, but check-in actions clamp awards to at least one and fall back to three; settings displays a different fallback. Use one rule, honour zero if allowed, and tell staff the award before committing it. [E14, E19, E23]

**T07 · P1 · Payment-pending recovery stops short.** The guest return poll stops after roughly a minute while leaving a pending message. There is no clear retry/check-status action or support action there; explicit failure/cancellation states are not differentiated. Give a persistent reference, a safe status refresh, “do not pay again while confirming” guidance where applicable, and a practical help route. Consolidate the two payment-return screens after confirming gateway configuration. [E22]

**T08 · P0 · QR verification returns private contact data without a staff-auth check.** The verification API validates possession of a signed token, then uses an admin client and returns name, phone, and email. No staff session/role check appears in that route, and the proxy does not cover it. A valid short-lived token is still a bearer credential, not proof of employee authority. Require the intended staff permission and return only necessary fields. This is a confirmed route-level concern, not a report of observed production exploitation. [E30]

**T09 · P1 · Account deactivation is not consistently part of eligibility checks.** Manual list lookup filters inactive members out, but card/QR/check-in paths largely evaluate membership dates/status rather than member `is_active`. If deactivation is intended only to hide duplicates, say so and model suspension separately. If it should block benefits/access, enforce that consistently at every decision point. Live database enforcement remains unverified. [E11, E14, E19, E27, E30]

**T10 · P1 · Repeating signup can replace existing paid access with free membership.** The existing-account branch signs the user in and continues through the same unconditional membership upsert that assigns `rewards_free`. An existing paid customer completing this form can therefore lose their selected access state before any new payment. Treat existing-member sign-in as account recovery/continuation, preserve existing entitlements, and make purchases explicit. Similarly, switching to free in Settings updates membership immediately without explaining the effect on remaining paid access. [E03, E08]

**T11 · P1 · Some scan failures disappear at the destination.** Scan actions redirect invalid-code/inactive/insert failures to `/checkins?err=…`, while the check-in index only reads `ok` and `range`. The failure is not rendered there. Keep the scanner context and show a clear reason with retry, manual lookup, or front-desk escalation. [E14]

## 8. Visual design and accessibility

### Is the design still relevant?

**Parts are.** The branded name, compact mobile navigation, card concept, restrained typography, and consistent rounded surfaces are useful. A dark member card can communicate club identity. There is no need to throw away the visual system simply because scope has expanded.

**The current treatment is too dominant for the new purpose.** Source styling is built around indigo aurora, translucent dark glass, large radii, repeated shadows, and layered cards. Combined with metric bubbles, streaks, and leaderboards, it reads more like a personal activity dashboard than a hotel relationship. That is a design judgement from the implementation, not a measured guest preference.

Recommended direction:

- Retain a distinctive branded digital card and a small set of accent treatments.
- Give guest pages clearer hierarchy, calmer surfaces, and prominent benefit-use actions. Consider a light hospitality presentation or a well-tested light/dark choice; do not assume dark-only works best outdoors.
- Use actual approved resort identity and occasional relevant property imagery on discovery/offer pages, not large decorative images on every task screen.
- Reserve brighter, consistent accents for actions. Current border-only controls often give primary and secondary actions similar weight.
- Reduce card-within-card nesting and decorative frames, particularly on Settings and staff records.
- Use a denser, flatter desktop workspace for staff, with a sidebar/top navigation and useful tables. Retain large action targets in gate/mobile modes.
- Use status colour plus text/icon, with one meaning per token. Avoid green “checked in” being mistaken for permission to enter a facility.

### Specific implementation risks

**D01 · P1 · Some form labels are visually present but not programmatically associated.** Join and several staff forms use sibling `<label>` elements without `htmlFor`/matching input IDs or wrapping. Associate labels, group choices with fieldsets/legends, and attach inline errors/descriptions. The login’s associated labels are a useful pattern to reuse. [E02, E03, E21]

**D02 · P1 · The authentication layout has no scroll container despite global scroll locking.** CSS fixes the body and hides document overflow. Member, staff, and join layouts create scrollable containers; the auth layout does not. Short screens, browser zoom, and the software keyboard may make login/recovery controls unreachable. Verify these states and use normal page scrolling where possible. This is a source-backed risk, not an observed device failure. [E31]

**D03 · P2 · Narrow nested layout wastes space.** The member experience is capped at `max-w-md`, with outer padding, a shell, inner padding, and card padding. Desktop retains a narrow phone layout, and small phones lose useful content width. Flatten containers on mobile and use available width deliberately on larger screens. [E31]

**D04 · P2 · Text and status readability need measurement.** Much secondary content is 11–13px or uses reduced opacity over layered surfaces; several alerts specify a light background without a consistently explicit dark text colour. Do not declare a contrast failure from styling alone. Measure actual rendered combinations, focus indicators, selected/unselected tabs, alerts, inputs, and disabled states. [E31]

**D05 · P2 · Navigation lacks some accessibility/context cues.** Tabs visibly distinguish the current page but omit `aria-current`; nav landmarks have no audience-specific label. Add these and a main landmark/skip link. Preserve a consistent active top-level area on detail pages. [E16]

**D06 · P2 · QR refresh text is not a live countdown.** Remaining seconds are recalculated only when token state changes. Use accurate expiry messaging and refresh on foreground/resume, without implying an expired code remains valid. Provide an accessible alternative to reading/scanning the image. [E11]

**D07 · P2 · CSS has accumulated competing overrides.** Repeated “final” definitions, pervasive `!important`, hard scroll locks, and tangled input nesting make outcomes fragile. Consolidate semantic tokens and supported component variants after the target hierarchy is agreed. Simplification helps prevent regressions, but should not become an unrelated wholesale rewrite. [E31]

Accessibility validation should cover WCAG 2.2 AA: normal text contrast at least 4.5:1 (large text 3:1), minimum target sizing/spacing, reflow at 320 CSS px, keyboard operation, focus visibility/obscuring, meaningful labels, and understandable status/error feedback. Prefer approximately 44–48px primary touch controls as a usability target; that is distinct from WCAG AA’s 24px minimum with exceptions. References: [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## 9. Recommended information architecture

### Guest navigation

Start with four destinations: **Home · Card · Benefits · Account**. Expose **Gym & resort access** prominently from Home, the relevant benefits, and the card’s access section. Promote Access to a fifth tab only if task testing shows enough frequent use; do not make every loyalty member navigate a gym section.

```text
Public introduction
├── Join free
├── Sign in / recover account / claim existing card
└── Explore gym & resort passes

Guest app
├── Home
│   ├── Show my card (primary action)
│   ├── Benefits relevant now
│   ├── Current access or verified stay context
│   └── Return-visit offer / direct-booking link when available
├── Card
│   ├── Persistent member identity and number
│   ├── QR for staff verification
│   ├── Loyalty membership state
│   └── Separate facility access, valid dates, help/fallback
├── Benefits
│   ├── Available perks by outlet/category
│   ├── Conditions and how to use
│   └── Used benefits / points and rewards only when operational
├── Gym & resort access (linked destination initially)
│   ├── My passes / renew
│   ├── Explore and compare
│   ├── Dates, eligibility, waiver, total
│   ├── Pay and activation confirmation
│   └── Visit history / optional fitness challenges
└── Account
    ├── Personal details and sign-in
    ├── Purchases and receipts
    ├── Communication preferences
    ├── Programme terms and privacy information
    └── Help / account requests / logout
```

Avoid adding an empty “My stay” tab. When a verified hotel integration exists, add a useful stay card or destination, including only services that the hotel can fulfil.

### Employee navigation

| Role | Default starting point | Essential tasks | Restrict or remove |
|---|---|---|---|
| Security/gate | Scan or lookup | Identify, confirm facility permission, record relevant visit, escalate exception | Revenue dashboards, broad editing, unnecessary contact/notes |
| Front desk | Service workspace | Find/create/claim member, sell/renew access, resolve requests, resend access link, payment exceptions | Programme-rule changes unless delegated |
| Restaurant/bar/outlet | Verify member | View outlet-specific eligibility, record benefit use, authorised redemption | Other outlets’ operations, payment administration, broad member records |
| Programme manager | Programme overview | Benefits, eligibility rules, future changes, programme performance, audit | Unnecessary routine gate detail |
| Administrator | Administration | Staff, permissions, integrations, privileged settings | Avoid making admin the required role for normal service |

For desktop front desk/management, use persistent navigation such as **Overview, Members, Access & sales, Requests, Benefits, Reports**, with Administration and staff account separate. Gate/outlet mobile mode should have a much smaller task set. This does not require six mobile tabs.

## 10. Minimum viable loyalty product

The simplest useful release is a **free digital benefits membership**, even without points. It should let a guest:

1. Understand the offer and join with minimal relevant information.
2. Receive an active, persistent member identity and show a usable card.
3. See an accurate benefit, understand its conditions, and use it with staff.
4. Retain membership after leaving the hotel or after a paid pass expires.
5. Find a concrete reason and route to return.
6. Buy/renew optional access without changing their loyalty identity.

The hotel must be able to verify that member, deliver the correct benefit, resolve exceptions, and measure usage. A named programme owner should maintain eligibility, exclusions, participating outlets, and staff instructions.

If points are retained, define before launch: qualifying actions/spend, exclusions, currency basis, credit timing, reversals/refunds, expiry, redemption thresholds, limits, availability, staff confirmation, adjustments, and dispute handling. Build an immutable transaction ledger with balances derived from it, rather than treating a headline number and example rewards as a complete programme. Keep any temporary manual process explicit and auditable.

Do not add gamification, a wallet integration, personalised recommendations, or booking-system depth before the basic benefit promise works reliably.

## 11. Roadmap and acceptance criteria

### Phase 0 — Make existing promises reliable

Resolve T01/T02/T08 first, then prices, paid dates, renewal, missing-plan routing, and benefit eligibility inconsistencies. Verify with isolated test data and a payment sandbox; do not repair records by guessing. Inspect existing purchases for impossible access dates and reconcile paid-but-unfulfilled payments before planning any production correction.

**Exit criteria:** A new purchase receives the intended period; renewal extends the appropriate entitlement; retries cannot lose or duplicate fulfilment; guest and staff see the same access decision; the advertised price matches confirmation; QR validation requires the intended permission.

### Phase 1 — Separate loyalty membership from access

Define programme policy, introduce persistent loyalty identity and explicit access entitlements, simplify free joining, remove unsupported points claims, and establish one canonical catalogue. Plan a migration that preserves existing member numbers, accounts, payment history, and entitlement dates. Redirect old links where needed.

**Exit criteria:** Free join is distinct from facility purchase; pass expiry does not end membership; a member can hold the required access products without overwriting loyalty identity; in-house guest rules are explicit; existing customers can still claim/sign in to their account.

### Phase 2 — Rebuild guest hierarchy and service workflows

Deliver the proposed Home/Card/Benefits/Account structure, a focused Access journey, role-specific scan actions, discoverable requests, full-directory lookup, clear payment exceptions, and basic member support. Flatten the visual system and correct accessibility risks alongside these journeys.

**Exit criteria:** Guests can join, show a card, explain a benefit, buy/renew access, and recover a problem without staff explaining the IA. Staff can distinguish membership, outlet benefit eligibility, and facility admission at a glance.

### Phase 3 — Demonstrate repeat business

Launch approved return-visit offers, record benefit usage with outlet/source, connect direct-booking attribution where feasible, and establish a reporting baseline. Introduce a complete points programme only if it has a business owner and working economics. Add verified stay context or wallet support when research demonstrates value.

**Exit criteria:** Management can see member return/use over an appropriate period, understand discount/reward cost, and distinguish measured attribution from assumed programme impact.

These are sequencing recommendations, not development-duration estimates. Scope, integrations, staffing, and production data quality have not been established.

## 12. Validation plan

Recruit a small initial mix of local gym members, local dining/day visitors, first-time hotel guests, returning hotel guests, and guests with lower digital confidence. Include front desk, security, and outlet employees. A first round of roughly 5–8 guests plus representative staff can expose obvious problems; repeat research with changed journeys rather than treating that sample as statistically representative.

| Scenario | What to observe | Proposed acceptance target, not a current measurement |
|---|---|---|
| Join free from a hotel QR/link | Can the guest state benefits and finish without facility confusion? | At least 90% success in a larger validation sample; initial time goal under a minute, subject to authentication method |
| Show card at restaurant | Can guest and staff complete validation without inventing a gym visit? | Card reachable within two taps from any main screen; verification goal under 10 seconds under normal network conditions |
| Guest asks “Can I use the gym?” | Is the answer correct for free, paid, verified-stay, expired, and suspended states? | All tested policy cases agree across guest and staff |
| Buy a future-start pass | Does the date survive signup, checkout, confirmation, and card? | Correct start/end/cutoff and price in every tested state |
| Renew current pass | Can the member retain the product and see the extension? | Successful renewal without changing plans or losing remaining valid service |
| Benefit use with poor connectivity | Are limitations and fallback clear? | No false access approval; staff can use an approved lookup/escalation procedure |
| Duplicate identity lookup | Does staff choose the right person? | No action attached to an unselected first match |
| Delayed/failed payment fulfilment | Can guest/staff recover without duplicate payment? | Reference and actionable status available; entitlement eventually reconciles |
| Accessibility | Keyboard, screen reader, zoom, short viewport, mobile keyboard, daylight | Core journeys usable; measured WCAG 2.2 AA issues addressed |

Device/state coverage: 320/375/390px-class mobile widths, laptop/desktop, iOS Safari and installed mode, Android browser/installed mode, 200% text enlargement and 400% zoom/reflow, denied camera, offline/reconnection, background/resume, expired session, QR expiry, duplicate submission, and slow payment confirmation. These remain to be executed.

## 13. Measure the intended outcome

Set a baseline before launch, and choose follow-up periods that fit different customer rhythms. Local members may return weekly; overseas hotel guests may return annually. A daily gym streak is a poor universal loyalty measure.

- **Acquisition:** Introduction → join completion, source of join, abandonment by step, existing-member account-claim success.
- **Activation:** First successful card validation and first benefit use, not app installation alone.
- **Retention:** Repeat outlet visits and repeat stays/bookings where identity/attribution is dependable; report local and travelling guests separately.
- **Access:** Purchase/renewal success, expiring-pass renewals, invalid admission attempts, fulfilment exceptions.
- **Service:** Lookup/validation time, staff correction rate, unsupported-benefit disputes, support requests.
- **Economics:** Attributable member revenue, discounts granted, reward cost, and margin-aware programme review. Observed repeat purchases do not by themselves prove incremental revenue.

Use pseudonymous member IDs for event analysis; avoid contact details, QR bearer tokens, payment credentials, and free-text notes in analytics. Track only what is needed to evaluate these journeys.

## 14. Source evidence index

Paths refer to the reviewed local checkout. The findings are anchored to implementation, not an assumed production deployment.

| ID | Source | Evidence |
|---|---|---|
| E01 | [Root routing](/Users/preston/gym-membership-app/app/page.tsx) | Unauthenticated root goes to login |
| E02 | [Login form](/Users/preston/gym-membership-app/components/login-form.tsx) | Combined staff/guest identifier, recovery, email-link and join paths |
| E03 | [Join](/Users/preston/gym-membership-app/app/join/page.tsx) | Public form, waiver, error URLs, application creation, free bootstrap, requested date |
| E04 | [Legacy signup](/Users/preston/gym-membership-app/app/auth/sign-up/page.tsx), [claim/create account](/Users/preston/gym-membership-app/app/join/create-account/create-account-client.tsx), [success](/Users/preston/gym-membership-app/app/join/success/page.tsx) | Multiple lifecycle paths |
| E05 | [Member home](/Users/preston/gym-membership-app/app/(member)/member/page.tsx) | Metrics, leaderboard, numeric tiers, upgrade and renewal destinations |
| E06 | [Tier explanation](/Users/preston/gym-membership-app/app/(member)/member/tier/page.tsx), [Points explanation](/Users/preston/gym-membership-app/app/(member)/member/points/page.tsx) | General tier copy, example rewards, spend/redemption promise |
| E07 | [Benefits](/Users/preston/gym-membership-app/app/(member)/member/benefits/page.tsx) | Static access copy, database discounts, repeated comparisons |
| E08 | [Member Settings](/Users/preston/gym-membership-app/app/(member)/member/settings/page.tsx) | Account/plan overlap, picker, direct free-plan update, comparisons |
| E09 | [Upgrade](/Users/preston/gym-membership-app/app/(member)/member/upgrade/page.tsx), [checkout creation](/Users/preston/gym-membership-app/app/api/fygaro/checkout/route.ts) | Required plan parameter; plan-only checkout |
| E10 | [PlanPicker](/Users/preston/gym-membership-app/components/member/plan-picker.tsx:33) | $25 day pass, spend earning copy, current-plan disabled |
| E11 | [Card](/Users/preston/gym-membership-app/app/(member)/member/card/page.tsx), [Rotating QR](/Users/preston/gym-membership-app/app/(member)/member/card/RotatingQr.tsx) | Membership number, QR loading/refresh/error behaviour |
| E12 | [Tier metadata](/Users/preston/gym-membership-app/lib/plans/tiers.ts), [status rules](/Users/preston/gym-membership-app/lib/membership/status.ts) | Static product copy, free status, expiry and Jamaica cutoff |
| E14 | [Scan workflow](/Users/preston/gym-membership-app/app/(staff)/checkins/scan/page.tsx), [scanner](/Users/preston/gym-membership-app/components/checkins/qr-scanner.tsx), [check-in list](/Users/preston/gym-membership-app/app/(staff)/checkins/page.tsx) | Auto-record, points, activity/access distinction, Dining Only, error redirects |
| E15 | [Install prompt](/Users/preston/gym-membership-app/components/pwa/install-app-prompt.tsx), [service worker](/Users/preston/gym-membership-app/public/sw.js), [manifest](/Users/preston/gym-membership-app/app/manifest.ts) | First-session install prompt, static-only cache |
| E16 | [Guest tabs](/Users/preston/gym-membership-app/components/nav/member-tabs.tsx), [staff tabs](/Users/preston/gym-membership-app/components/nav/bottom-tabs.tsx), [topbar](/Users/preston/gym-membership-app/components/nav/staff-topbar.tsx) | Destinations, active state, staff profile discoverability |
| E17 | [More](/Users/preston/gym-membership-app/app/(staff)/more/page.tsx), [Applications](/Users/preston/gym-membership-app/app/(staff)/applications/page.tsx) | Queue exists but lacks main navigation entry |
| E18 | [Role proxy](/Users/preston/gym-membership-app/proxy.ts), [staff layout](/Users/preston/gym-membership-app/app/(staff)/layout.tsx) | Existing roles and route protection |
| E19 | [Members and gate lookup](/Users/preston/gym-membership-app/app/(staff)/members/page.tsx) | Limits before filters, first match, manual check-in, ineffective override |
| E20 | [Payment index](/Users/preston/gym-membership-app/app/(staff)/payments/page.tsx) | 400-row window, search after fetch, omitted status/currency |
| E21 | [Add payment](/Users/preston/gym-membership-app/app/(staff)/members/[memberId]/add-payment/page.tsx), [plan actions](/Users/preston/gym-membership-app/app/(staff)/members/[memberId]/actions.ts) | Money recording versus entitlement update; inclusive end dates |
| E22 | [Payment return](/Users/preston/gym-membership-app/app/(member)/member/payment-return/page.tsx), [alternate return](/Users/preston/gym-membership-app/app/(member)/member/payment/return/page.tsx), [export](/Users/preston/gym-membership-app/app/(staff)/payments/export/route.ts) | Pending polling, payment-only confirmation, parallel return route, CSV endpoint |
| E23 | [Rewards Manager](/Users/preston/gym-membership-app/app/(staff)/more/rewards/page.tsx), [staff Settings](/Users/preston/gym-membership-app/app/(staff)/settings/page.tsx) | Benefits/discount/access settings, page-driven schedules, duplicate points setting |
| E24 | [Auto-downgrade](/Users/preston/gym-membership-app/lib/membership/auto-downgrade.ts) | Staff-page maintenance, inactive paid rows, date/plan replacement |
| E25 | [Activity Logs](/Users/preston/gym-membership-app/app/(staff)/settings/logs/page.tsx) | Payment and check-in event view |
| E26 | [Staff dashboard](/Users/preston/gym-membership-app/app/(staff)/dashboard/page.tsx) | Membership/gym metrics; active-only totals omit due-soon access |
| E27 | [Member profile](/Users/preston/gym-membership-app/app/(staff)/members/[memberId]/page.tsx), [deactivation migration](/Users/preston/gym-membership-app/supabase/migrations/20260220102000_members_soft_deactivate.sql) | Reactivation and record status |
| E28 | [Payment webhook](/Users/preston/gym-membership-app/app/api/fygaro/webhook/route.ts:143) | Paid-first fulfilment, early retry exit, future-date extension, UTC dates |
| E29 | [Day-price migration](/Users/preston/gym-membership-app/supabase/migrations/20260428110000_day_pass_price_to_15.sql) | Intended $15 price in available migration |
| E30 | [QR verification API](/Users/preston/gym-membership-app/app/api/qr/verify/route.ts) | Token validation, admin data read, returned contact fields, absent staff guard |
| E31 | [Global styles](/Users/preston/gym-membership-app/app/globals.css), [root layout](/Users/preston/gym-membership-app/app/layout.tsx), [auth layout](/Users/preston/gym-membership-app/app/auth/layout.tsx), [member layout](/Users/preston/gym-membership-app/app/(member)/layout.tsx) | Dark theme, glass styling, nested containers, fixed body and scroll behaviour |

**Decision:** Preserve the platform and the Travellers Club identity. Rebuild the relationship between free loyalty and paid access, correct the unreliable lifecycle paths, and make benefit use the centre of both the guest and hotel experiences.

## Implementation addendum

Following the audit, the user clarified that the intended products are **$15 gym-only daily access** and a **$25 resort day pass with the existing wider inclusions**. The original price-discrepancy finding should be read as a need for distinct products, rather than choosing one price for both purposes. The user confirmed retaining the existing $25 inclusions.

The initial implementation and remaining rollout/follow-up work are documented in [the implementation notes](/Users/preston/gym-membership-app/docs/implementation/2026-11-12-loyalty-access-foundation.md). Source links above describe the original audit evidence; many linked screens have now been replaced or restructured.
