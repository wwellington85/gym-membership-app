# Club card design implementation

Apply the selected Club card direction across the guest and employee app: white surfaces, navy identity, clear status colors, restrained borders, compact rows, and a prominent digital membership card.

## Scope

- Replace the accumulated dark glass overrides with one light token system and reusable surfaces, fields, alerts, buttons, metrics, navigation, and card styles. Keep legacy `oura-*` component names as light compatibility hooks so existing routes migrate together.
- Force the supported light appearance, including browsers that stored the previous dark preference. Update the PWA manifest, iPhone status-bar metadata, browser theme color, and static asset cache version. Regenerate social sharing previews with the same visual language.
- Give Home and Card the shared navy membership component, showing the actual current product, name, complete lookup number, and readable expiry. The permanent identity stays separate from dated access. The live rotating QR remains in its own white verification panel; no static or decorative QR is presented as valid access.
- Use labelled icons and a selected background in the five-item member navigation. Keep the employee mobile tabs and desktop sidebar in the same light component family, with existing role visibility preserved.
- Update Gym, rankings, visit history, benefits, passes, purchases, Account, help, sign-in, signup, recovery, invitations, staff workflows, programme settings, and activity logs for readable light surfaces. Remove duplicate branding/back chrome and route the unused starter account destination to the current post-login flow.
- Preserve automatic Gym starting screens, explicit destinations, current benefit calculations, pass/renewal dates, payment fulfilment, permissions, and existing member records. Google provider setup is outside this visual release and remains unconfigured.

## Validation

77 tests pass, including new rendered-card/navigation checks and contrast checks against the actual palette for normal text, secondary text, primary actions, digital-card copy, success/warning/error states, and input boundaries. ESLint, TypeScript, and the production build pass. HTTP checks cover public/auth routes, light manifest, generated sharing images, and protected-member redirects.

The Mac was initially locked. After it was unlocked, the browser connector remained unavailable and computer-use permission for Google Chrome was not approved. The generated share image was visually inspected, but app screenshots, phone layouts, and larger-text checks remain acceptance work. No guest was impersonated and no real transactions were used. The database tests now use a deterministic daytime clock inside their isolated PGlite fixture, avoiding failures when day passes cross the real Jamaica closing time. Production date rules are unchanged.

No database migration or member-data changes are needed. Existing Home Screen installations should reload to fetch the new app styles; the cache version was advanced to retire old static assets.
