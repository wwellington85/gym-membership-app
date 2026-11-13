# Email signup rejection and Google identity branding

## Diagnosis

Read-only gym Supabase Auth logs showed two POST /signup requests at 22:59:59 and 23:01:08 Jamaica time on 12 November 2026, both returning 422 with the message that the password is known to be weak and easy to guess. These coincide with the reported 23:01 signup screenshot. The client caught every exception and replaced the useful password explanation with a generic signup failure. No guest password was obtained, no signup was retried on the guest's behalf, and no member records or authentication policies were changed.

## Change

Map known authentication failures into safe, actionable signup messages. Weak-password errors request a stronger unique password; a specifically reported compromised-password reason explains that rejection. Rate limits, invalid email and connection errors have distinct recovery guidance. Unknown errors and existing-account failures retain non-enumerating copy, and arbitrary backend exception text is never echoed. The password hint now explains that common/compromised passwords are not accepted. The existing eight-character client minimum and server protections remain intact.

86 tests pass, with regressions for weak-password rejection, compromised-password reasons, rate limits, connectivity, and suppression of raw private error text. Lint and TypeScript pass; production build is verified for release.

## Google hostname

The current Supabase callback hostname is expected in this configured OAuth flow, but its unfamiliar project identifier is a trust/usability issue. Supabase recommends Google brand verification (name/logo, which may take a few business days) and/or a custom authentication domain such as auth.tbr.travel. A custom domain is a paid add-on currently documented as $0.0137/hour, approximately $10/month. No paid service, DNS change or brand-verification submission was made as part of the signup fix.

Sources: [Supabase Google branding guidance](https://supabase.com/docs/guides/auth/social-sign-in/auth-google#setup-consent-screen-branding), [custom-domain pricing](https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains).
