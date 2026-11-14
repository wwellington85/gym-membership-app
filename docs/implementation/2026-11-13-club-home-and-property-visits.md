# Club Home and property visits

The existing gym check-ins were front-gate property visits. Present them as Club visits without rewriting or replacing their history. All active Rewards members may receive a verified property visit, independently of paid facility access.

## Member experience

- Four tabs: Home, Card, Benefits, Account. Home shows a beach photograph, compact membership summary and card shortcut, actual current pass inclusions, visit/point/rank progress and achievements, effective discounts, and property photographs.
- Old /member/gym links redirect to /member#club-visits. Existing Gym start preferences open Home. The Card page remains the full digital card and live QR destination.
- The inline emblem appears early from the root layout during installed Home launches. Its entrance lasts 320ms; the solid white canvas holds for at least 1.1 seconds and waits for Home/hero readiness, then dissolves over Home for 800ms. A five-second escape prevents an indefinite overlay. It runs once per full installed Home document launch, does not replay during in-app navigation, does not capture taps, and is disabled for reduced motion. iOS controls its own initial launch screen.
- Photographs are optimized WebP exports of the user's beach sunset, restaurant terrace, pool, gym and games lounge photographs. Original files remain untouched. Cabana rentals are separate and booking is deferred; no rental functionality or unsupported inclusions are advertised.

## Daily check-in

Migration 20261114010000_club_property_visits.sql adds record_club_visit, preserves record_gym_visit as a compatibility wrapper, and adds a server-only point total aggregate. A member-row lock serializes gate/restaurant requests. A second request on the same America/Jamaica date returns false without creating a visit or points. Each new visit earns exactly 3 points. Inactive members and unauthorized/inactive staff are rejected. Existing staff roles remain unchanged; restaurant staff use an authorized staff account. A check-in never grants facility access, and benefit-use recording remains separate.

Applied successfully to gym Supabase bdnwjalcopncpccdnivn before app deployment. Pre/post comparison: 218 visits, 654 points, history fingerprint ab04eda9d9b701873b364de9913b1149 unchanged. Club RPC ready; authenticated-browser execution denied. Aggregate point total verified at 654. No live test visits were inserted.

## Management rankings

/checkins/rankings allows admin and front_desk staff to view monthly/all-time rankings with names, visit totals, last-visit dates, pagination and member-record links. It calls the same member_leaderboard_rankings RPC as the guest leaderboard, preserving tie ordering and Jamaica month boundaries. Staff member records show rank, visits and actual recorded points. Guest rankings retain anonymous display aliases. Entry points: dashboard, Club visits and desktop staff sidebar.

## Validation

Database tests exercise daily duplicate prevention across both RPC names and staff locations, next-day awards, free-member eligibility, inactive membership/staff rejection, and server-only access. Management rendering tests cover role restrictions, shared ranking RPC, pagination, linked identities and service failures. Existing benefit/navigation/card/auth/payment tests remain included.

Production build, lint, full tests and diff whitespace checks run before release. Exact standalone iPhone launch animation and safe-area behavior need confirmation on an actual installed iPhone; browser/device visuals were not verified for this release.
