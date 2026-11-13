# Installed iPhone app viewport layout

The reported Home Screen screenshot shows a large blank strip below the floating navigation. A screenshot alone cannot distinguish an oversized native WebKit viewport inset from app spacing, and desktop resizing cannot reproduce iOS's installed-app shell.

The app previously combined Apple's default (inset) status-bar presentation with 100svh scroll containers. This change uses black-translucent full-screen presentation, keeps explicit top/bottom system safe areas, and uses 100dvh for installed-app scroll containers. A navy strip behind the top safe area preserves contrast for light iOS system indicators; the application content remains white. Browser-tab appearance and viewport sizing stay as before. Installed member pages reserve 104px plus the bottom inset for scrolling the last controls above the floating navigation, rather than 128px plus the inset. The static cache version advances.

No screen-height guesses, negative viewport offsets, disabled zoom, or user-agent sniffing are introduced. No authentication/data changes. Existing installed shortcuts may need to be removed and added again for iOS to use the updated status-bar metadata. Real-device relaunch, orientation, keyboard dismissal, and bottom-scroll checks remain necessary; this is a targeted correction, not a claim that all native WebKit gutter bugs are resolved.

Sources: [Apple status-bar/full-screen metadata](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html), [WebKit standalone safe-area report](https://bugs.webkit.org/show_bug.cgi?id=301172), [WebKit orphan-viewport strip report](https://bugs.webkit.org/show_bug.cgi?id=313800).

Validation: 86 tests, lint, TypeScript, production build pass. Browser preview of actual member components at 393×852 with simulated 62px/34px safe areas filled an 852px content viewport, placed the header at 86px, and left a 26px navigation gap. The final help link could scroll 40px above the navigation. This simulation verifies CSS geometry only, not actual iOS viewport allocation or system icon rendering.
