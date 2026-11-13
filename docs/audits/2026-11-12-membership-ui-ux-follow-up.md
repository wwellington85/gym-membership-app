# Travellers Club interface and experience audit

The app should continue as one membership product with a guest experience and a staff workspace. A lighter hospitality design is a better fit for the next iteration: clear entitlements, a prominent membership card, restrained resort photography, and compact useful information. The main priority is trust in the displayed membership data. A theme change alone would leave the current inconsistencies unresolved.

This follow-up covers the current guest routes, staff workflows, iPhone screenshots, shared styles, membership rules, and sign-in configuration. It builds on the earlier IA audit rather than repeating findings that were already addressed. Signed-in visual observations use the supplied screenshots; source review and live data checks establish the reported causes. This is a UI/UX and source review, not an accessibility certification, security penetration test, or assessment of waiver enforceability.

## Findings and immediate corrections

Priority 1 means an incorrect membership decision or broken core experience. Priority 2 means a substantial usability or accessibility problem. Priority 3 means polish or a useful enhancement.

| Priority | Finding and evidence | Effect | Action and status |
| --- | --- | --- | --- |
| 1 | Gym summary requests ranking functions absent from the live database. `lib/member/leaderboard.ts`, ranking migration. | An established member sees unavailable rank despite recorded visits. | Install the ranking functions, restrict their execution to the app server, and verify the real summary. Corrected in this release. |
| 1 | Home reads only the free Rewards catalogue while Benefits and staff verification also consider active pass snapshots. `member/page.tsx`, `member/benefits/page.tsx`, staff scan. | One member sees different discount entitlements across screens. | Share one per-outlet maximum calculation across all three surfaces. Use current Rewards rates plus frozen active pass benefits; never stack. Corrected in this release. |
| 2 | Full words such as “Unavailable” share the numeric font in narrow metric cells. The supplied iPhone screenshot shows the final letter on a separate line, increasing all three cells' height. | A broken-looking dashboard and wasted vertical space. | Keep values numeric or a dash, explain failures outside the cells, and distinguish unranked from unavailable. Corrected in this release. |
| 2 | Metric tiles inherit the large radius, blur, highlight, and shadow of primary cards. `oura-card` overrides in `globals.css`. | Small digits sit inside large decorative containers. | Use compact, flat metric tiles with stronger numeric hierarchy and a 12px radius. Corrected in this release; broader card styles belong to the redesign. |
| 2 | Inactive members could still see the Home base-discount summary below an assistance warning. | Conflicting signals about whether a benefit can be used. | Suppress the usable-benefits summary while the member is inactive. Corrected with the shared eligibility rule. |

For the reported monthly product, current entitlements are restaurant/bar 20%, spa 15%, gift shop 15%, and watersports 15%, rather than the current free Rewards rates of 10% at each outlet. These are live configuration/snapshot values, not newly invented programme promises. Complimentary payment does not reduce the benefits of the assigned product.

## Guest journeys

| Priority | Area and evidence | Recommendation and acceptance criterion |
| --- | --- | --- |
| 2 | Home repeats membership explanations, an oversized card shortcut, full benefit prose, and facilities before discovery. | Lead with name, active membership, one card action, and concise current benefits. Explain the free/paid distinction contextually, once. On a 390px phone, the card action and benefit summary should require little or no scrolling. |
| 2 | Home and Gym use nearly the same large glass treatment for every section. | Give membership, metrics, activity, and editorial discovery different visual weights. Use ordinary rows for secondary information rather than wrapping everything in a card. |
| 2 | Card labels every member “Travellers Rewards” even when an active Club Monthly product is present. `member/card/page.tsx`. | Keep one permanent membership identity, but prominently show the current product and access status. Display multiple active passes as dated entitlements below the card. Never imply that card possession alone guarantees current facility access. |
| 2 | Card and other copy still says “paid access” where a complimentary pass can grant the same facilities. | Use “facility access,” “active pass,” and “complimentary” where payment source matters. Audit empty, expired, inactive, and upcoming states together. |
| 2 | Renewal can produce a long list of overlapping or future passes; access management lists everything in sequence. | Group Valid now, Upcoming, and Previous; show the relevant renewal action next to its product. Preserve multiple passes and explicit dates. |
| 2 | Benefits show the correct maximum percentage but do not explain which product supplies each rate or its end date. | Add “From Club Monthly · until [date]” when a pass improves the base rate. After expiry, explicitly show that free Rewards continues. Keep outlet-specific terms adjacent to the benefit. |
| 2 | Date strings such as `2026-12-11` and repeated “10 pm Jamaica time” slow scanning. | Display “Until 11 Dec 2026” with a compact secondary expiry rule. Keep exact Jamaica dates and closing time on confirmation and entitlement details. |
| 2 | Purchase confirmation repeats the new shared back link and its own “Back to access.” `member/upgrade/page.tsx`. | Keep one page-header back control. Preserve a stable parent on every secondary page; root tabs stay directly selectable. |
| 2 | Help asks guests to contact the front desk without a concrete contact action. `member/help/page.tsx`. | Add verified phone/WhatsApp/contact links and service availability when the hotel supplies them. Do not invent contact details. |
| 2 | Sign-up has no visible privacy/terms destination in the current form. | Add the hotel's approved membership terms and privacy information at the point of joining. Keep marketing permission separate and optional. Review the facility waiver with the appropriate owner before changing its substance. |
| 2 | Home Screen and browser authentication can have separate storage, already demonstrated by the email flow. | Retain email-code entry in the requesting app. Test every added provider on iPhone standalone mode, Safari, Gmail links, Android, and desktop; successful Safari login is not proof of a signed-in Home Screen app. |
| 2 | Sign-up depends on name, email, password, and confirmation email; Google is disabled and unconfigured. | Add Continue with Google on guest Join and Login after provider setup. Retain email/password and email-code choices. A verified returning Google identity must keep the existing member, passes, and check-ins. |
| 3 | Gym ranks are all-time by default; a former member can have a high lifetime rank and no current streak. | Label the period explicitly; retain monthly and all-time views. Explain that verified visits determine rank. Keep a zero streak neutral, with a helpful next action rather than a failure treatment. |
| 3 | Gym summary streak history is bounded to the latest 120 check-ins. | Before promoting very long streaks or challenges, compute streaks in the database and test daily duplicates, Jamaica midnight, and gaps. Do not imply unlimited historical precision from the current bounded query. |
| 3 | The service worker caches static assets but does not provide a usable offline membership entitlement. | Show an explicit offline state and offer staff lookup. Never present an expired rotating QR as valid access. Wallet passes would be a separate signed-pass project, not a static copy of the QR. |

## Hotel and employee workflows

| Priority | Area and evidence | Recommendation and acceptance criterion |
| --- | --- | --- |
| 1 | The recent staff grant incident exposed legacy schema differences absent from the original test fixture. | Maintain migration preflight checks against actual constraints/functions, and a deployed schema smoke check for access grants, benefits, and ranking. The compatibility fixture now covers legacy payments; extend this operational check before each release. |
| 2 | Complimentary and paid grants share one form, and an error redirect resets the selected product/method/notes. | Preserve safe draft state after validation failure and show an inline review of product, dates, amount, method, and reason before submitting. Do not place private notes in URLs. A repeat submit must remain idempotent. |
| 2 | A complimentary receipt is technically stored as paid with amount zero. | Present “Complimentary · $0 recorded” to staff and members; reserve ordinary “Paid” presentation for money collected. Keep the receipt and authorising staff audit. |
| 2 | Programme updates and paid pass snapshots intentionally have different timing. | Show administrators which changes affect free Rewards now, new sales, scheduled future sales, or existing frozen passes. Preview representative free, monthly, complimentary, and expired memberships before publishing a programme change. |
| 2 | Staff payment filtering treats `paid` and null as recorded, but the legacy schema also permits `succeeded`; refunded/cancelled states are not equally visible. `search_club_payments`. | Normalize display/filter semantics without replaying or reclassifying historical payments automatically. Explicitly distinguish collected, complimentary, pending, activation review, refunded, and failed. |
| 2 | Settings calls itself “app preferences” but mainly links to staff management, programme benefits, and logs. | Use task-based headings: Staff access, Programme and products, Audit history. Prioritise Lookup, Verify, Record visit, and Grant access for front-desk users. |
| 2 | Staff verification previously calculated benefits separately from guest Home. | Share the display calculation and retain authoritative database validation when recording use. Exercise the same product/date scenarios on guest and staff screens; correcting presentation must never grant extra access. |
| 3 | Security and front-desk operators have different work but share much of the glass-heavy styling. | Use a denser operational light interface with strong result states and large scan/lookup targets. Apply the same tokens and component family as the guest app, while prioritising speed over resort imagery. |

## Recommended visual direction

Adopt a light hospitality interface with warm off-white surfaces, dark readable text, a deep coastal green accent, and restrained sand tones. Use genuine hotel photography in a few discovery contexts; keep access status, financial information, and QR surfaces opaque and quiet. The supplied Priority Pass references demonstrate useful principles: hierarchy, a recognisable digital card, purposeful photography, and a clearly selected navigation item. Do not reproduce its logo, member data, visual identity, booking features, or Wallet functionality unless those features actually exist.

The preferred concept is **Coastal welcome**: a warm opening, one current-membership summary, clear active benefits, and easy access to Gym. **Club card** is an alternative with a more formal navy/white treatment and the digital membership card as the leading object. Both concepts retain Home, Gym, Card, Benefits, and Account so members do not have to relearn the IA.

### Component rules

- Page padding 16–20px on phones; section gaps 20–24px; one primary action per section.
- Body text 15–16px, supporting labels 12–13px, page titles 26–30px. Use tabular numbers for metrics; give their values more emphasis than the container.
- Primary membership surfaces 16–20px radius; metrics 10–12px; reserve full pills for short status labels. Avoid nested glass cards and repeated heavy shadows.
- Use opaque white/light surfaces and dark text. Replace opacity-based secondary text with explicit semantic colors. Verify contrast for normal text, labels, borders, focus, disabled controls, and error/success states on actual backgrounds.
- Use labelled icons in the bottom navigation and a selected background plus weight, not color alone. Maintain touch targets around 44px and safe-area clearance.
- Keep the dark digital card or an optional future dark appearance where useful. Do not globally flip the current theme flag: many current rules hard-code white text, dark backgrounds, and late `!important` overrides.

### Screen hierarchy

Home: welcome → membership/card shortcut → benefits valid today → optional hotel discovery.

Gym: access status/card shortcut → compact visits, streak, rank → recent visits → rankings/history.

Card: permanent member identity → live verification QR → access valid now → dated entitlement details.

Benefits: current per-outlet rates and source → terms → optional discovery → use history.

Account: contact and sign-in methods → starting-screen preference → receipts → help/privacy actions → log out.

## Google sign-up and account continuity

Google is a good optional addition. Configure the Google Cloud OAuth client and consent information, the Supabase callback, approved app redirect URLs, and provider credentials on the server. Start with identity scopes only; do not request Gmail, Contacts, Drive, or unrelated permissions. Publish approved privacy/support information and test the consent-screen and production configuration.

Use Supabase's supported Google flow and identity-linking behavior. Keep one member record per authenticated identity; claim a staff-created existing membership only after verified email ownership and never transfer a member already linked to another user. Existing memberships, access snapshots, purchases, and visits must survive signing in by another method. Different-email linking should be an explicit signed-in account action, not an automatic merge by name.

Google is not enabled in this release because the project has no configured Google OAuth client or secret. No placeholder Google button should be exposed until the complete flow works. Test success, denial, wrong Google account, existing email/password identity, staff-created membership, staff sign-in separation, iPhone Home Screen storage, and lost/cancelled callbacks before enabling it for guests.

Sources: [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

## Rollout and acceptance

1. Correct ranking availability, benefit consistency, and metric overflow first. Apply the missing ranking functions only to the gym project; verify server-only execution and an actual summary. These fixes retain the live theme.
2. Review the two light design concepts and select a direction. Build shared typography, surface, button, status, and navigation tokens; migrate Home/Gym/Card/Benefits/Account together, followed by auth and staff screens.
3. Configure Google and validate account continuity plus iPhone standalone behavior before showing the option publicly.
4. Browser preview was unavailable in this chat, so the new layouts and concepts still need visual acceptance on a phone. Complete acceptance testing at 320, 375/390, and 430 CSS pixels, desktop, larger text, keyboard, slow/offline network, and the free/active/complimentary/expired/future/inactive membership matrix. Include real guest and front-desk task sessions before calling the redesign validated.

Success means a member and employee see the same current benefit, the card can be presented quickly, complimentary and paid access are equally clear, long status text never breaks a metric cell, and every sign-in method returns to the correct member record and requested screen.
