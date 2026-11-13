# Rankings and member benefit consistency

The Gym summary's ranking RPCs were missing from the gym database. Install `20261112223000_member_leaderboard_access.sql` to restore all-time/monthly summaries and rows. Execution is restricted to service_role; guests see server-generated display aliases rather than raw aggregate RPC output. The migration is applied to the gym project, and a service-client summary call succeeded after the PostgREST schema cache refreshed. No visits, memberships, or payment records changed.

Home previously displayed free Rewards rates regardless of an active monthly pass. `lib/access/benefits.ts` now supplies the same effective per-outlet percentage to Home, Benefits, and staff verification. It takes the highest eligible free/active-pass rate without stacking, ignores expired/future/revoked passes, and suppresses benefits for inactive members. Database benefit-use validation remains authoritative.

Gym progress now uses compact, flat numeric tiles. Failed/unranked values use a dash with explanatory text outside the row, preventing an unavailable-status word from wrapping inside a narrow numeric cell. The full theme remains unchanged pending review of the light design concepts.

Validation: 71 tests, ESLint, TypeScript, and production build pass. Regression tests cover live-schema ranking RPCs and permissions, active monthly vs free rates, complimentary access, expiry/cutoff, inactive states, and rendered Home benefit values. Concept navigation was executed locally with a simulated DOM. Browser access was unavailable in this chat, so mobile pixel-level verification and the real signed-in iPhone round trip remain acceptance steps. The temporary sample-data fixtures were never added to the app or deployed.

Google sign-in is recommended in the accompanying audit, but is not enabled: the gym project has no configured Google OAuth client or secret. No fake or nonfunctional Google button was added.
