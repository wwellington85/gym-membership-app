# Gym section and member navigation

## Member experience

- Shared bottom navigation: Home, Gym, Card, Benefits, Account.
- Gym shows current facility access, card and renewal links, verified visit count, current day streak, all-time ranking, achievements, recent visits, and links to full history and rankings. Former members retain history and achievements; unavailable metrics are shown as unavailable rather than zero.
- On a fresh sign-in or authenticated launch from `/`, automatic selection opens Gym only for an active gym-specific pass. Price and payment source do not affect selection, so complimentary gym access qualifies equally. Resort passes that include gym access keep Home. Expired, future, revoked, and inactive access does not trigger the automatic Gym default.
- Account → Starting screen supports Automatic, Home, or Gym. Store only `member_start_screen` in the signed-in user's Auth metadata; it is a display preference, never an access decision. No migration is needed. Choosing Gym without a pass does not grant access.
- Explicit member deep links override the starting-screen default. The proxy forwards the actual path and query to the login gate, overwriting any incoming return header. Home always stays Home when selected from the tabs; there is no redirect loop between Home and Gym.
- Secondary pages receive a labelled back link to a stable parent. Top-level tabs do not have redundant back buttons. Remove the previous timer that could replace a successful browser-back navigation. Sanitize explicit return destinations.
- Hide the skip link outside normal visual layout, overriding the root aurora positioning rule. Reveal it on focus, and make the main content focusable so keyboard users can activate it.

## Verification

63 tests pass across the existing suite and 14 navigation tests. Coverage includes paid/complimentary selection, resort and expired access, Jamaica closing time, display overrides, unavailable metrics, preference writes and failures, safe parent navigation, deep-link preservation, and former-member rendering. ESLint, TypeScript, and the production build pass.

In a browser against the production build: the public page hides the skip link initially; Tab reveals it; Return focuses main content. An unauthenticated `/member/leaderboard?period=month` preserves that destination through login. The signed-in iPhone interaction remains a user verification step; no guest credentials were used or changed during validation.
