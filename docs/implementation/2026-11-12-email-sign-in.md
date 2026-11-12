# Email sign-in across browsers and Home Screen apps

A guest requested a magic link from the iOS Home Screen app, then opened it in Safari. The existing ConfirmationURL used PKCE, so the receiving browser could not exchange the code without the original browser's verifier.

## Changes

- Preserve the existing email branding and replace ConfirmationURL with SiteURL `/auth/confirm` links carrying TokenHash. The existing callback verifies the token using `verifyOtp`, which does not need the original browser's cookies. Recovery links explicitly return to `/auth/update-password`; confirmation and login links use `/auth/post-login`.
- Include the one-time code in the magic-link email. Guests can enter it in the original Home Screen app, avoiding the separate Safari session entirely. Using a code or its paired link consumes the credential; request a fresh email after a failed/consumed link.
- Keep guests on the code entry screen after requesting an email; allow entering a code already requested, changing email, and resending after a local 60-second cooldown. Supabase enforces server-side limits. Do not automatically create accounts from the login flow.
- Replace raw SDK errors with plain-language recovery actions. Keep legacy PKCE callbacks supported for existing emails.

## Operations

Only the gym Supabase project `bdnwjalcopncpccdnivn` is in scope. Use `scripts/lib/auth-email-templates.cjs` to prepare the three template fields from their current values. Back up those fields privately before applying a narrow PATCH to `config/auth`, then GET and compare the resulting fields. No SMTP credentials, sender, rate limits, user passwords, or existing users change. Never commit an unfiltered Auth configuration response.

Existing emails retain their original links. A new email is required to receive the new link and code. A browser session does not automatically sign in a separately installed Home Screen app: use the code in that app, or sign in there with a password. Email links use the default post-login destination; code entry preserves the requested in-app destination.

## Validation

49 tests, including token-hash callback verification without a PKCE exchange, failed-token handling, external redirect rejection, legacy callback support, and email template conversion. Lint, TypeScript, and production build. A real iPhone Home Screen/Gmail round trip still requires guest verification; no guest password changes or additional emails were triggered during implementation.

Reference: https://supabase.com/docs/guides/auth/auth-email-passwordless
