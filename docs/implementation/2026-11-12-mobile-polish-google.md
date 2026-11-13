# Mobile safe areas, Club icon, and Google authentication

## Mobile and identity

Member headers now add 24px beyond the top safe-area inset, so the initial wordmark sits below iOS status-area blur. The shared floating member/staff navigation moves 12–20px lower, using a minimum 8px gap and retaining the home-gesture inset. Scroll containers retain bottom clearance so their last controls can scroll above navigation.

The new navy/white TC membership-card mark comes from `public/brand/club-icon.svg`. `node scripts/generate-club-icons.cjs` renders the PWA, maskable, Apple touch, and multi-size ICO assets from that single master. The design fits the maskable safe circle. Metadata icon URLs and the service-worker cache version change to retire old assets. iOS can retain an installed icon until the user removes and re-adds the Home Screen shortcut; reopening alone is not guaranteed to replace it.

## Google flow and production activation

Guest Join and Login support an optional Continue with Google action. It is hidden unless the server environment variable `GOOGLE_AUTH_ENABLED=true`. Employee Login retains its existing flow. `/auth/google` starts server-side PKCE using the existing cookie-backed Supabase SSR client. The callback exchanges the code and then uses the existing shared account-setup handler. This preserves linked members, passes, and visits, requires verified ownership to claim an unlinked member, and never merges different-email records by name. Explicit guest return destinations are retained; otherwise the current membership starting-screen rules apply. Cancellation/failure returns a readable email fallback without exposing provider details.

Enable only after configuring the gym Supabase project (`bdnwjalcopncpccdnivn`), never Travellers Apps Portal:

1. In Google Cloud, configure the OAuth consent branding and a Web application client. Use identity only (openid, email, profile); no Gmail or other account-data scopes.
2. Authorized JavaScript origin: `https://club.tbr.travel`. Authorized redirect URI: `https://bdnwjalcopncpccdnivn.supabase.co/auth/v1/callback`.
3. Configure the Google client ID and secret in the gym project's Supabase Google provider. Do not put the secret in this repository, client bundle, or chat.
4. Supabase site URL: `https://club.tbr.travel`. Allow the app redirect `https://club.tbr.travel/auth/google/callback`. Add only deliberately supported development/preview callbacks.
5. Configure production `GOOGLE_AUTH_ENABLED=true`, deploy, then check new and returning guest accounts, same-email identity continuity, denial/retry, Gym defaults, and iPhone standalone/Safari behavior. Do not infer an authenticated Home Screen session from a Safari-only success.

The owner approved the Google policy, creation of the restricted OAuth client, privacy notice publication, and public sign-in activation. Google Cloud project `tbr-travellers-club` is owned by the hotel account; support/developer contact is `tbr.frontdesk@gmail.com`. The initial personal-account project `travellers-club-514603` is unused and has no OAuth client. No IAM access was granted to bridge the two accounts.

The owner entered the Google client ID/secret directly into the gym Supabase provider and enabled it. The dashboard confirmed Google ENABLED. Skip nonce checks and email-less sign-in remain off. The existing Club redirect allowlist covers the callback. The approved privacy notice is public at `https://club.tbr.travel/privacy` and linked from landing, signup, login, and Google branding. Google data access declares only OpenID, userinfo.email, and userinfo.profile. Google publishing status was verified as In production after owner approval. Production `GOOGLE_AUTH_ENABLED=true` enables the guest button; secrets stay in Supabase, not Vercel source or chat.

A complete sign-in with a real guest account and iPhone Home Screen return remains acceptance work. Verification must distinguish reaching Google's account/consent screen from completing the callback and matching the existing membership.

Sources: [Supabase Google authentication](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), and [cookie-backed SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).

## Validation

82 tests pass, including Google disabled-state, return-path restrictions, PKCE start, callback exchange, and cancellation fallback. Lint and TypeScript pass. Production build passes. Browser checks at 393px verified 24px initial header padding, 8px navigation gap when no device inset is reported, no horizontal overflow, and the disabled Google route returning the email sign-in fallback. Actual iPhone safe-area rendering still needs confirmation from a device; the desktop viewport does not reproduce iOS system blur. No member data or database schema changes.
