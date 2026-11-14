# Travellers Club member experience audit

Reviewed 14 November 2026 against the production account/access model, source, current member screenshots and anonymous database totals. This was a source/data audit with server-rendered UI checks, not an on-device visual walkthrough.

## Findings and changes

| Finding | Result |
|---|---|
| Free accounts saw four 0% rows, “how to use a benefit” instructions and policy explanations | Home and Benefits now display only positive eligible discounts. Free accounts focus on visit points and weekly/monthly upgrades. |
| Upgrade cards repeated “today 0%” | Removed zero comparisons; members with real existing rates can still compare them with a plan. Zero-rate plan outlets are omitted. |
| Benefits lacked an understandable order | Current access, usable discounts and extra perks appear when applicable, followed by points and relevant upgrades. Free members start with points. |
| All members were shown the same eligibility explanation | Copy now reflects actual access and Local Rewards status, rather than describing internal approval rules on every screen. |
| Future monthly passes still attracted duplicate upgrade prompts | Scheduled access is now shown with its start date on Home, Benefits and Card. Already owned current/scheduled weekly choices are excluded; current/scheduled monthly access suppresses the upgrade section. |
| Inactive accounts could see earning/upgrade language | Inactive members see assistance and historical points without active-access or earning promises. |
| “Jamaica time” and “Jamaica calendar day” repeated in member screens | Removed repeated labels from Home, Card, passes, checkout, payment return and visit history. Actual timezone calculations and the 10 pm cutoff remain unchanged. Help states once that times are local to the resort. |
| Points page described them only as activity history | Legacy Points links now go to the Benefits points section. Home labels points “Points earned”; Benefits explains future rewards and that redemption is not live yet. |
| Mixed “check-ins,” “visits,” “benefit uses” and “rewards” | Member-facing visit badges/history use Visits; discount usage is Discount history. The live membership QR is described as a visit/benefit verification code, not a reward voucher. |
| Complimentary purchases appeared simply as $0 paid | Account purchase history identifies the recorded complimentary payment method as a complimentary pass. |

## Journey checks

| Member state | Home and Benefits experience |
|---|---|
| Free, no approval | Earned points, digital card, future-rewards message, swipeable weekly/monthly options. No zero discount list or discount-use instructions. |
| Approved Local Rewards | Approved positive outlet discounts/custom perks and points. Facility access is not inferred from approval. Upgrades remain available. |
| Gym-only pass | Only gym in the current facilities section; actual snapshot discounts; resort upgrade options. |
| Resort day pass | Current resort facilities and actual discounts; longer-plan options. |
| Weekly | Current weekly benefits; only monthly upgrade. |
| Monthly, paid or complimentary | Current monthly access and benefits; no upgrade prompts. Renewals remain in Manage access. |
| Scheduled pass | Start date shown explicitly, no early facility/discount entitlement. No duplicate promotion of that plan. |
| Ended/revoked pass | No current paid entitlement; approved Local Rewards continues independently. Relevant new-pass options return. |
| Complimentary extension | All screens continue reading the authoritative extended expiration. Snapshot benefits and original payment remain intact. |
| Inactive account | Assistance and historical data; no active benefits, upgrade prompts or earning promises. |
| Points service failure | Unavailable state, never a fabricated zero. |

## Data and business observations

A read-only aggregate query returned 55 accounts, 219 recorded visits, 657 earned points and zero extra same-day entries. Two accounts currently have at least 30 points. If every member spent only on a proposed 30-point reward, existing individual balances could fund 13 redemptions in total before further visits. These are earned points, not a spendable ledger balance: no redemption mechanism is currently active.

Property visits include facility users and do not establish restaurant purchases or customer profitability. Lifetime rank should continue to reflect visits even after spendable points are introduced. A paid Club pass, Local Rewards outlet discount and points reward are distinct entitlements; one should not accidentally grant another.

## Verification and limits

Server-rendered matrix tests cover free, approved, gym, weekly, complimentary monthly, scheduled, expired, revoked, inactive and points-error states on Home/Benefits. Existing database, auth, payment, ranking, extension and launch checks also pass: 121 tests total. ESLint and a clean production build pass. No points, approvals, passes or financial records were changed by this audit. Physical mobile visual verification was unavailable.

Reward economics and QR redemption are a proposal, not a live offer; see [the visit rewards proposal](../implementation/2026-11-14-visit-rewards-proposal.md).
