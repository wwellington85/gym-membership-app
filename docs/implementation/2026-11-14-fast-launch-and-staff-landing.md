# Fast installed launch and staff landing

## Launch

The installed manifest previously opened `/`, which resolved auth and then sent signed-in users through `/auth/post-login` and legacy start routing. The splash was eligible only on the final Home route, so earlier waits were white and route changes could recreate the branding.

New installations start at static `/app`. It renders the root inline branding without waiting on authentication. `AppEntry` resolves a small private, no-store `/api/app-entry` response, then uses the Next router to navigate within the same document. The root splash survives the route change and waits for Home/hero readiness before the existing exit fade. Existing `/` shortcuts also get early branding and client routing; normal public browser visits retain the landing page. The logo uses a 260ms opacity-only entrance, stable full-vh height and fixed text line-height, with no movement transform.

The resolver performs read-only identity checks: existing members to Home, admins/front desk to Dashboard, security to verification, signed-out or inactive staff to login. Inactive staff are signed out. Missing member linkage goes through the existing verified-email enrolment flow; startup does not rewrite memberships. Destination pages retain their own authorization. The client accepts only a fixed destination allowlist, cancels on unmount, and offers retry/sign-in on failure. No auth/provider configuration or database migration is required.

The iOS-owned initial launch frame and network request before the first HTML paint cannot be controlled by this web animation. Real cold-launch behavior still needs device confirmation.

## Staff landing

Security keeps its direct verification landing. Admin/front desk Dashboard now prioritizes card verification/check-in and member lookup, with registration, visit history and rankings shortcuts. Membership requests and paid activation issues form the attention queue. Visits today, active members and access counts remain compact below. Benefit-use statistics and pending checkout attempts move into a collapsed Programme activity section; pending attempts are distinguished from confirmed payments. Summary failures show unavailable values while service actions stay available. The top bar clearly identifies Management, Front desk or Gate.

Validation: 104 tests passed, including destination/role/inactive-staff handling, private no-store responses, missing-link enrolment routing, client destination allowlist, cancelled navigation, ordinary-browser behavior, task ordering and dashboard failure states. Lint and clean production build passed; `/app` is statically rendered and `/api/app-entry` is dynamic. No actual iPhone cold-launch visual check was performed before release.
