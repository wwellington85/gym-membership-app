# Restore the seamless white installed-app background

The owner rejected the colored status-area strip added with the installed-app viewport correction. Remove the fixed body pseudo-element that painted this strip and obscured scrolling content beneath it. The existing white page canvas now continues through the top safe area.

Keep full-screen iOS metadata, standalone dynamic viewport sizing, header safe-area padding, and reduced bottom scroll clearance. This restores visual continuity without placing the wordmark underneath the status icons or reverting unrelated signup and Google-auth work. Advance the static cache version so existing installations retire the overlay CSS.

This CSS-only correction does not establish that a native iOS reserved viewport strip has disappeared. Real-device confirmation is still needed; browser previews cannot emulate the installed iPhone shell.

## Compact membership reference

The shared Home/Card component now shows an explicitly abbreviated reference (for example `TC · …64746D2B`). Its native disclosure reveals the complete, selectable membership number on demand. The suffix is a display reference, not a newly issued unique number. Full identifiers, staff lookup parsing, and rotating QR verification are unchanged; no migration or member renumbering is involved. Regression coverage checks the compact summary, initially collapsed disclosure, and preserved full number.

Validation: 86 tests, lint, and production build pass. In the actual-component sample-data browser fixture with simulated safe areas, the closed reference was visually checked at 393px, and expanding it at 320px retained the complete selectable number with no horizontal page overflow. The white canvas replaced the colored overlay. Native iOS system presentation still requires the owner's device confirmation.
